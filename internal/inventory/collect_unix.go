package inventory

import (
	"context"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

type processIdentity struct{ name, started string }

const linuxProcessQuery = `IFS= read -r boot < /proc/sys/kernel/random/boot_id || exit 1
for dir in /proc/[0-9]*; do
[ -d "$dir" ] || continue
IFS= read -r stat < "$dir/stat" 2>/dev/null || continue
IFS= read -r name < "$dir/comm" 2>/dev/null || continue
fields=${stat##*) }; set -- $fields
[ "$#" -ge 20 ] || continue
printf '%s\t%s/%s\t%s\n' "${dir##*/}" "$boot" "${20}" "$name"
done`

func (c *collector) processes(ctx context.Context) (map[int]processIdentity, bool) {
	if c.goos == "linux" {
		data, err := c.query(ctx, "sh", "-c", linuxProcessQuery)
		processes, bad := parseLinuxProcesses(data)
		return processes, bad || err != nil
	}
	// comm excludes arguments and environment. Locale-independent lstart fields
	// are used as a start token, not as a wall-clock transition timestamp.
	data, err := c.query(ctx, "env", "LC_ALL=C", "ps", "-axo", "pid=,lstart=,comm=")
	processes, bad := parseProcesses(data)
	return processes, bad || err != nil
}

func parseLinuxProcesses(data []byte) (map[int]processIdentity, bool) {
	result := map[int]processIdentity{}
	bad := false
	for _, line := range strings.Split(string(data), "\n") {
		if line == "" {
			continue
		}
		fields := strings.SplitN(line, "\t", 3)
		if len(fields) != 3 || fields[2] == "" {
			bad = true
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		boot, ticks, ok := strings.Cut(fields[1], "/")
		if err != nil || pid <= 0 || !ok || boot == "" || !digits(ticks) {
			bad = true
			continue
		}
		result[pid] = processIdentity{name: filepath.Base(fields[2]), started: fields[1]}
	}
	return result, bad
}

func parseProcesses(data []byte) (map[int]processIdentity, bool) {
	result := map[int]processIdentity{}
	bad := false
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 7 {
			bad = true
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err != nil || pid <= 0 {
			bad = true
			continue
		}
		result[pid] = processIdentity{name: filepath.Base(strings.Join(fields[6:], " ")), started: strings.Join(fields[1:6], " ")}
	}
	return result, bad
}
func parseSystemd(data []byte, source string) Collection {
	col := Collection{Coverage: Coverage{Source: source, State: "ok"}, Services: []Service{}}
	fields := map[string]string{}
	flush := func() {
		if len(fields) == 0 {
			return
		}
		id := fields["Id"]
		if !strings.HasSuffix(id, ".service") || fields["ActiveState"] == "" {
			col.State = "partial"
			fields = map[string]string{}
			return
		}
		name := fields["Description"]
		if name == "" {
			name = id
		}
		pid, err := strconv.Atoi(fields["MainPID"])
		if err != nil || pid < 0 {
			pid = 0
			col.State = "partial"
		}
		col.Services = append(col.Services, Service{Key: id, Source: source, Name: name, PID: pid, State: serviceState(fields["ActiveState"]), Ports: []int{}})
		fields = map[string]string{}
	}
	for _, line := range strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n") {
		if strings.TrimSpace(line) == "" {
			flush()
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			col.State = "partial"
			continue
		}
		if key == "Id" && fields["Id"] != "" {
			flush()
		}
		switch key {
		case "Id", "Description", "ActiveState", "SubState", "MainPID":
			fields[key] = value
		default:
			col.State = "partial"
		}
	}
	flush()
	return parsedCoverage(col)
}
func parseLaunchd(data []byte, source string) Collection {
	col := Collection{Coverage: Coverage{Source: source, State: "ok"}, Services: []Service{}}
	inServices, found, closed := false, false, false
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !inServices {
			if line == "services = {" {
				inServices = true
				found = true
			}
			continue
		}
		if line == "}" {
			closed = true
			break
		}
		fields := strings.Fields(line)
		if len(fields) != 3 {
			if line != "" {
				col.State = "partial"
			}
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err != nil || pid < 0 {
			col.State = "partial"
			continue
		}
		state := "stopped"
		if pid > 0 {
			state = "running"
		} else if fields[1] != "-" {
			exit, err := strconv.Atoi(fields[1])
			if err != nil {
				col.State = "partial"
				continue
			}
			if exit != 0 {
				state = "failed"
			}
		}
		col.Services = append(col.Services, Service{Key: fields[2], Source: source, Name: fields[2], State: state, PID: pid, Ports: []int{}})
	}
	if !found || !closed {
		col.State = "partial"
	}
	return parsedCoverage(col)
}
func serviceState(raw string) string {
	switch strings.ToLower(raw) {
	case "active", "running", "restarting":
		return "running"
	case "inactive", "stopped", "exited", "dead", "ready", "disabled", "created":
		return "stopped"
	case "failed", "deadfailed":
		return "failed"
	default:
		return "unknown"
	}
}
func parsedCoverage(col Collection) Collection {
	if col.State == "partial" {
		col.Error = "Some collector records were incomplete; previous observations are retained."
		if len(col.Services) == 0 {
			col.State = "error"
		}
	}
	return col
}
func parseLsof(data []byte, processes map[int]processIdentity) Collection {
	col := Collection{Coverage: Coverage{Source: "listeners", State: "ok"}, Services: []Service{}}
	ports := map[int][]int{}
	pid := 0
	for _, line := range strings.Split(string(data), "\n") {
		if line == "" {
			continue
		}
		switch line[0] {
		case 'p':
			var err error
			pid, err = strconv.Atoi(line[1:])
			if err != nil || pid <= 0 {
				pid = 0
				col.State = "partial"
			}
		case 'c', 'f': // The process snapshot supplies the executable basename.
		case 'n':
			port := endpointPort(line[1:])
			if port == 0 || pid == 0 {
				col.State = "partial"
				continue
			}
			ports[pid] = append(ports[pid], port)
		default:
			col.State = "partial"
		}
	}
	return listenersFromPorts(col, ports, processes)
}

var ssPIDPattern = regexp.MustCompile(`pid=([0-9]+)`)

func parseSS(data []byte, processes map[int]processIdentity) Collection {
	col := Collection{Coverage: Coverage{Source: "listeners", State: "ok"}, Services: []Service{}}
	ports := map[int][]int{}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 || fields[0] != "LISTEN" {
			col.State = "partial"
			continue
		}
		port := endpointPort(fields[3])
		matches := ssPIDPattern.FindAllStringSubmatch(line, -1)
		if port == 0 || len(matches) == 0 {
			col.State = "partial"
			continue
		}
		for _, match := range matches {
			pid, err := strconv.Atoi(match[1])
			if err != nil || pid <= 0 {
				col.State = "partial"
				continue
			}
			ports[pid] = append(ports[pid], port)
		}
	}
	return listenersFromPorts(col, ports, processes)
}
func listenersFromPorts(col Collection, ports map[int][]int, processes map[int]processIdentity) Collection {
	pids := make([]int, 0, len(ports))
	for pid := range ports {
		pids = append(pids, pid)
	}
	slices.Sort(pids)
	for _, pid := range pids {
		process, ok := processes[pid]
		if !ok || process.started == "" {
			col.State = "partial"
			continue
		}
		slices.Sort(ports[pid])
		ports[pid] = slices.Compact(ports[pid])
		col.Services = append(col.Services, Service{Key: strconv.Itoa(pid) + "/" + process.started, Source: "listeners", Name: process.name, State: "running", PID: pid, ProcessStarted: process.started, Ports: ports[pid]})
	}
	return parsedCoverage(col)
}
func endpointPort(endpoint string) int {
	i := strings.LastIndexByte(endpoint, ':')
	if i < 0 {
		return 0
	}
	port, err := strconv.Atoi(endpoint[i+1:])
	if err != nil || port < 1 || port > 65535 {
		return 0
	}
	return port
}
