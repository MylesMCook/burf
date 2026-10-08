package localchat

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Empty fields preserve the thread's existing settings. Permissions are never
// widened merely by reconnecting a newer client.
type TurnOptions struct {
	Model      string `json:"model,omitempty"`
	Effort     string `json:"effort,omitempty"`
	Permission string `json:"permission,omitempty"`
}

func (o TurnOptions) validate() error {
	if len(o.Model) > 200 || strings.ContainsAny(o.Model, "\x00\r\n") {
		return errors.New("invalid model")
	}
	// Efforts are names the provider's model advertises, not a fixed list.
	if len(o.Effort) > 32 || strings.ContainsFunc(o.Effort, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '_')
	}) {
		return errors.New("invalid reasoning effort")
	}
	switch o.Permission {
	case "", "strict", "read-only", "workspace":
	default:
		return errors.New("invalid permission mode")
	}
	return nil
}
func (o TurnOptions) apply(p map[string]any, cwd string) {
	if o.Model != "" {
		p["model"] = o.Model
	}
	if o.Effort != "" {
		p["effort"] = o.Effort
	}
	if o.Permission != "" {
		p["approvalPolicy"] = "on-request"
		p["approvalsReviewer"] = "user"
		p["sandboxPolicy"] = map[string]any{"type": "readOnly", "networkAccess": false}
		if o.Permission == "strict" {
			p["approvalPolicy"] = "untrusted"
		}
		if o.Permission == "workspace" {
			p["sandboxPolicy"] = map[string]any{"type": "workspaceWrite", "writableRoots": []string{cwd}, "networkAccess": false, "excludeSlashTmp": true, "excludeTmpdirEnvVar": true}
		}
	}
}

type Model struct {
	Model                     string `json:"model"`
	DisplayName               string `json:"displayName"`
	DefaultReasoningEffort    string `json:"defaultReasoningEffort"`
	Hidden                    bool   `json:"hidden"`
	SupportedReasoningEfforts []struct {
		Effort string `json:"reasoningEffort"`
	} `json:"supportedReasoningEfforts"`
}

// Discover options on demand, not in the critical path to the first message.
func (m *Manager) Models(ctx context.Context, id string) ([]Model, error) {
	r, err := m.get(id)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	raw, err := r.call(ctx, "model/list", map[string]any{"limit": 100, "includeHidden": false})
	if err != nil {
		return nil, err
	}
	var result struct {
		Data []Model `json:"data"`
	}
	if err = json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	if len(result.Data) > 100 {
		return nil, errors.New("model list exceeded limit")
	}
	out := []Model{}
	for _, model := range result.Data {
		if !model.Hidden && model.Model != "" {
			out = append(out, model)
		}
	}
	return out, nil
}
