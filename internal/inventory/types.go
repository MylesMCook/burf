// Package inventory remembers observed services without owning their lifecycle.
package inventory

import "time"

type Route struct {
	Kind   string `json:"kind"` // local, paired or ssh
	Target string `json:"target,omitempty"`
}

type Machine struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	OS        string    `json:"os,omitempty"`
	Routes    []Route   `json:"routes"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Service struct {
	ID             string    `json:"id"`
	MachineID      string    `json:"machine_id"`
	Key            string    `json:"key"`
	Source         string    `json:"source"`
	Name           string    `json:"name"`
	State          string    `json:"state"`
	Health         string    `json:"health,omitempty"`
	Ports          []int     `json:"ports"`
	PID            int       `json:"pid,omitempty"`
	ProcessStarted string    `json:"process_started,omitempty"`
	Location       string    `json:"location,omitempty"`
	Worktree       string    `json:"worktree,omitempty"`
	ObservedAt     time.Time `json:"observed_at"`
}

type Coverage struct {
	Source string    `json:"source"`
	State  string    `json:"state"` // ok, partial, unavailable or error
	Error  string    `json:"error,omitempty"`
	At     time.Time `json:"at"`
}

type Collection struct {
	Coverage
	Services []Service `json:"services"`
}

type Snapshot struct {
	Machine  Machine    `json:"machine"`
	Services []Service  `json:"services"`
	Coverage []Coverage `json:"coverage"`
	At       time.Time  `json:"at"`
}

type Change struct {
	ID        int64     `json:"id"`
	MachineID string    `json:"machine_id"`
	ServiceID string    `json:"service_id"`
	At        time.Time `json:"at"`
	Before    *Service  `json:"before,omitempty"`
	After     Service   `json:"after"`
	Gap       bool      `json:"gap"`
}
