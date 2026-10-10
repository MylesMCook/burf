package desktop

import (
	"encoding/json"
	"fmt"
	"runtime"
)

// Event delivery tests the current native document before dispatching private
// browser diagnostics or deep links. Wails' default transport checks only that
// a runtime global exists, which a foreign document can create itself.
func eventScript(origin, name string, data any) (string, error) {
	payload, err := json.Marshal(struct {
		Name   string `json:"name"`
		Data   any    `json:"data"`
		Sender string `json:"sender"`
	}{name, data, "main"})
	if err != nil {
		return "", err
	}
	trusted, _ := json.Marshal(origin)
	return fmt.Sprintf("if(window.top===window&&window.location.origin===%s&&window._wails&&typeof window._wails.dispatchWailsEvent==='function'){window._wails.dispatchWailsEvent(%s)}", trusted, payload), nil
}

func (s *Service) emit(name string, data any) {
	origin := "http://wails.localhost"
	if runtime.GOOS == "darwin" {
		origin = "wails://localhost"
	}
	script, err := eventScript(origin, name, data)
	if err == nil && s.main != nil {
		s.main.ExecJS(script)
	}
}
