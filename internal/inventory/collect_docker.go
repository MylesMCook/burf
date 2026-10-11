package inventory

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"slices"
	"strconv"
	"strings"
	"unicode"
)

const dockerEndpointQuery = `if [ -n "$DOCKER_HOST" ] && [ -z "$DOCKER_CONTEXT" ]; then printf '%s\n' "$DOCKER_HOST"; else docker context inspect --format '{{.Endpoints.docker.Host}}'; fi`
const dockerWindowsEndpointQuery = `$ErrorActionPreference='Stop';try{if($env:DOCKER_HOST -and !$env:DOCKER_CONTEXT){[Console]::Write($env:DOCKER_HOST)}else{$value=& docker context inspect --format '{{.Endpoints.docker.Host}}';if($LASTEXITCODE -ne 0){exit 1};$value}}catch{exit 1}`
const dockerInspectTemplate = `{"id":{{json .Id}},"name":{{json .Name}},"state":{{json .State.Status}},"health":{{if (index .State "Health")}}{{json (index (index .State "Health") "Status")}}{{else}}""{{end}},"pid":{{json .State.Pid}},"started":{{json .State.StartedAt}},"ports":{{json .NetworkSettings.Ports}},"project":{{if .Config.Labels}}{{json (index .Config.Labels "com.docker.compose.project")}}{{else}}""{{end}}}`

func (c *collector) docker(ctx context.Context) Collection {
	var data []byte
	var err error
	if c.goos == "windows" {
		data, err = c.powershell(ctx, dockerWindowsEndpointQuery)
	} else if c.target == "" {
		if host := os.Getenv("DOCKER_HOST"); host != "" && os.Getenv("DOCKER_CONTEXT") == "" {
			data = []byte(host)
		} else {
			data, err = c.query(ctx, "docker", "context", "inspect", "--format", "{{.Endpoints.docker.Host}}")
		}
	} else {
		data, err = c.query(ctx, "sh", "-c", dockerEndpointQuery)
	}
	if err != nil {
		return c.finish(ctx, Collection{Coverage: Coverage{Source: "docker", State: "unavailable"}, Services: []Service{}}, err)
	}
	endpoint := strings.TrimSpace(string(data))
	if !localDockerEndpoint(endpoint) {
		return failure("docker", "unavailable", "Docker context does not select a local socket; remote Docker engines are not inspected.")
	}
	data, err = c.dockerCommand(ctx, endpoint, "container", "ls", "--all", "--no-trunc", "--quiet")
	if err != nil {
		return c.finish(ctx, Collection{Coverage: Coverage{Source: "docker", State: "error"}, Services: []Service{}}, err)
	}
	ids := strings.Fields(string(data))
	for _, id := range ids {
		if !containerID(id) {
			return failure("docker", "error", "Docker returned malformed container identities; previous observations are retained.")
		}
	}
	col := Collection{Coverage: Coverage{Source: "docker", State: "ok"}, Services: []Service{}}
	// Keep Windows command lines comfortably below their native limit.
	for start := 0; start < len(ids); start += 100 {
		end := min(start+100, len(ids))
		args := []string{"container", "inspect", "--format", dockerInspectTemplate}
		args = append(args, ids[start:end]...)
		data, err = c.dockerCommand(ctx, endpoint, args...)
		batch := parseDocker(data)
		col.Services = append(col.Services, batch.Services...)
		if err != nil || batch.State != "ok" {
			col.State = "partial"
			col.Error = "Some containers could not be inspected; previous observations are retained."
		}
		if ctx.Err() != nil {
			break
		}
	}
	if col.State == "partial" && len(col.Services) == 0 {
		col.State = "error"
	}
	return c.finish(ctx, col, nil)
}
func localDockerEndpoint(endpoint string) bool {
	if strings.IndexFunc(endpoint, unicode.IsControl) >= 0 {
		return false
	}
	return strings.HasPrefix(endpoint, "unix:///") || strings.HasPrefix(strings.ToLower(endpoint), "npipe:////./pipe/")
}
func containerID(id string) bool {
	if len(id) != 64 {
		return false
	}
	for _, r := range id {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'f') {
			return false
		}
	}
	return true
}
func (c *collector) dockerCommand(ctx context.Context, endpoint string, args ...string) ([]byte, error) {
	if !localDockerEndpoint(endpoint) {
		return nil, errors.New("nonlocal Docker endpoint")
	}
	if c.target == "" {
		command := append([]string{"--host", endpoint}, args...)
		return c.query(ctx, "docker", command...)
	}
	if c.goos == "windows" {
		// Clear inherited context selection, then force the verified local socket.
		parts := []string{"docker", "--host", endpoint}
		parts = append(parts, args...)
		for i := range parts {
			parts[i] = "'" + strings.ReplaceAll(parts[i], "'", "''") + "'"
		}
		script := "$env:DOCKER_CONTEXT=$null;$env:DOCKER_HOST=$null;$out=& " + strings.Join(parts, " ") + ";if($LASTEXITCODE -ne 0){$out;exit 1};$out"
		return c.powershell(ctx, script)
	}
	command := []string{"-u", "DOCKER_CONTEXT", "-u", "DOCKER_HOST", "docker", "--host", endpoint}
	command = append(command, args...)
	return c.query(ctx, "env", command...)
}
func parseDocker(data []byte) Collection {
	col := Collection{Coverage: Coverage{Source: "docker", State: "ok"}, Services: []Service{}}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var row struct {
			ID      string                                 `json:"id"`
			Name    string                                 `json:"name"`
			State   string                                 `json:"state"`
			Health  string                                 `json:"health"`
			PID     int                                    `json:"pid"`
			Started string                                 `json:"started"`
			Project string                                 `json:"project"`
			Ports   map[string][]struct{ HostPort string } `json:"ports"`
		}
		if err := json.Unmarshal([]byte(line), &row); err != nil || row.ID == "" || row.Name == "" || row.PID < 0 {
			col.State = "partial"
			continue
		}
		ports := []int{}
		for _, bindings := range row.Ports {
			for _, binding := range bindings {
				port, err := strconv.Atoi(binding.HostPort)
				if err != nil || port < 1 || port > 65535 {
					col.State = "partial"
					continue
				}
				ports = append(ports, port)
			}
		}
		slices.Sort(ports)
		ports = slices.Compact(ports)
		health := ""
		switch row.Health {
		case "healthy", "unhealthy", "starting":
			health = row.Health
		}
		state := serviceState(row.State)
		// A paused container still owns a process but is not running work.
		if row.State == "dead" {
			state = "failed"
		}
		if row.State == "paused" || row.State == "removing" {
			state = "unknown"
		}
		col.Services = append(col.Services, Service{Key: row.ID, Source: "docker", Name: strings.TrimPrefix(row.Name, "/"), State: state, Health: health, PID: row.PID, ProcessStarted: row.Started, Location: row.Project, Ports: ports})
	}
	return parsedCoverage(col)
}
