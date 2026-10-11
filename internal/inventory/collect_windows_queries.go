package inventory

import (
	"encoding/json"
	"slices"
	"strings"
)

// Projections exclude service executable arguments, task actions, credentials,
// and environment. The envelope reports partial account visibility explicitly.
const windowsServices = `$ErrorActionPreference='Stop';try {
$partial=$false;$rows=@(Get-CimInstance -ClassName Win32_Service | ForEach-Object {
$s=$_;$state=$s.State;if($state -eq 'Stopped' -and $s.ExitCode -ne 0){$state='Failed'};$started='';if($s.ProcessId -gt 0){try{$started=(Get-Process -Id $s.ProcessId).StartTime.ToUniversalTime().ToString('o')}catch{$partial=$true}}
[pscustomobject]@{key=$s.Name;name=$s.DisplayName;state=$state;pid=[int]$s.ProcessId;started=$started;ports=@()}
});[pscustomobject]@{services=$rows;partial=$partial}|ConvertTo-Json -Depth 4 -Compress
}catch{exit 1}`
const windowsTasks = `$ErrorActionPreference='Stop';try {
$errors=@();$rows=@(Get-ScheduledTask -ErrorAction SilentlyContinue -ErrorVariable errors | ForEach-Object {
$task=$_;$state=$task.State.ToString();try{$info=$task|Get-ScheduledTaskInfo; $result=[long]$info.LastTaskResult;if($state -eq 'Ready' -and $info.LastRunTime.Year -gt 1900 -and $result -ne 0 -and ($result -lt 267008 -or $result -gt 267016)){$state='Failed'}}catch{$errors+=1}
[pscustomobject]@{key=($task.TaskPath+$task.TaskName);name=$task.TaskName;state=$state;pid=0;started='';ports=@()}
});[pscustomobject]@{services=$rows;partial=($errors.Count -gt 0)}|ConvertTo-Json -Depth 4 -Compress
}catch{exit 1}`
const windowsListeners = `$ErrorActionPreference='Stop';try {
$partial=$false;$rows=@(Get-NetTCPConnection -State Listen | Group-Object OwningProcess | ForEach-Object {
try{$p=Get-Process -Id ([int]$_.Name);$started=$p.StartTime.ToUniversalTime().ToString('o');[pscustomobject]@{key=($p.Id.ToString()+'/'+$started);name=$p.ProcessName;state='Running';pid=$p.Id;started=$started;ports=@($_.Group.LocalPort|Sort-Object -Unique)}}catch{$partial=$true}
});[pscustomobject]@{services=$rows;partial=$partial}|ConvertTo-Json -Depth 4 -Compress
}catch{exit 1}`

func parseWindows(data []byte, source string) Collection {
	col := Collection{Coverage: Coverage{Source: source, State: "ok"}, Services: []Service{}}
	var envelope struct {
		Services *[]struct {
			Key     string `json:"key"`
			Name    string `json:"name"`
			State   string `json:"state"`
			PID     int    `json:"pid"`
			Started string `json:"started"`
			Ports   []int  `json:"ports"`
		} `json:"services"`
		Partial bool `json:"partial"`
	}
	// Windows PowerShell may include a UTF-8 BOM or surrounding whitespace.
	data = []byte(strings.TrimPrefix(strings.TrimSpace(string(data)), "\ufeff"))
	if err := json.Unmarshal(data, &envelope); err != nil || envelope.Services == nil {
		col.State = "partial"
		return parsedCoverage(col)
	}
	if envelope.Partial {
		col.State = "partial"
	}
	for _, row := range *envelope.Services {
		if row.Key == "" || row.Name == "" || row.PID < 0 {
			col.State = "partial"
			continue
		}
		ports := []int{}
		for _, port := range row.Ports {
			if port < 1 || port > 65535 {
				col.State = "partial"
				continue
			}
			ports = append(ports, port)
		}
		slices.Sort(ports)
		ports = slices.Compact(ports)
		if source == "listeners" && (row.PID == 0 || row.Started == "") {
			col.State = "partial"
			continue
		}
		col.Services = append(col.Services, Service{Key: row.Key, Source: source, Name: row.Name, State: serviceState(row.State), PID: row.PID, ProcessStarted: row.Started, Ports: ports})
	}
	return parsedCoverage(col)
}
