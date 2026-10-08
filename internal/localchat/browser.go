package localchat

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"
)

// BrowserServer names the bridge to the provider. A chat started with browser
// tools gets one stdio MCP server under this name, on its own thread only: the
// provider account's configuration is never edited.
const BrowserServer = "burf_browser"

const (
	maxBrowserTools       = 16
	maxBrowserDescription = 2 << 10
	maxBrowserSchema      = 8 << 10
	maxBrowserArguments   = 256 << 10
	maxBrowserPending     = 4
	maxBrowserContent     = 16
	// One answer, text and images together. It fits the request limit of the
	// client relay that carries it to the box.
	maxBrowserResult = 2 << 20
)

// browserWait is how long a call waits for the browser. It ends before the
// provider's own tool timeout (browserToolTimeout) so the reason is Burf's.
var browserWait = 290 * time.Second

const browserToolTimeout = 300

var browserToolName = regexp.MustCompile(`^[a-z][a-z0-9_]{0,47}$`)

// BrowserTool is one action the attached browser offers the provider.
type BrowserTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema,omitempty"`
}

// Browser attaches one client's browser tools to a single chat.
type Browser struct {
	Tools []BrowserTool
	// Server is the command the provider starts for this chat's bridge.
	Server func(chat string) (command string, args []string)
}

// BrowserCall is a provider request waiting for the browser to perform it.
type BrowserCall struct {
	ID        string          `json:"id"`
	Tool      string          `json:"tool"`
	Arguments json.RawMessage `json:"arguments"`
}

type BrowserContent struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	Data     string `json:"data,omitempty"`
	MimeType string `json:"mime_type,omitempty"`
}

// BrowserResult is what the browser did, in the shape of an MCP tool result.
type BrowserResult struct {
	Content []BrowserContent `json:"content"`
	IsError bool             `json:"is_error,omitempty"`
}

// BrowserState is the bridge as a chat's clients see it.
type BrowserState struct {
	Tools []BrowserTool `json:"tools,omitempty"`
	Calls []BrowserCall `json:"calls"`
}

func (b *Browser) validate() error {
	if b.Server == nil {
		return errors.New("browser tools are unavailable")
	}
	if len(b.Tools) == 0 || len(b.Tools) > maxBrowserTools {
		return errors.New("offer 1 to 16 browser tools")
	}
	seen := map[string]bool{}
	for i, t := range b.Tools {
		if !browserToolName.MatchString(t.Name) || seen[t.Name] {
			return errors.New("invalid or repeated browser tool name")
		}
		seen[t.Name] = true
		if t.Description == "" || len(t.Description) > maxBrowserDescription || strings.ContainsRune(t.Description, 0) {
			return errors.New("browser tool " + t.Name + " needs a description of at most 2048 bytes")
		}
		if len(t.InputSchema) == 0 {
			b.Tools[i].InputSchema = json.RawMessage(`{"type":"object"}`)
			continue
		}
		var schema map[string]json.RawMessage
		if len(t.InputSchema) > maxBrowserSchema || json.Unmarshal(t.InputSchema, &schema) != nil {
			return errors.New("browser tool " + t.Name + " needs an object schema of at most 8192 bytes")
		}
	}
	return nil
}

// threadConfig is the per-thread provider configuration that offers the tools.
// They are approved at the provider because the browser itself is the reviewer:
// it asks the user per site before acting.
func (b *Browser) threadConfig(chat string) map[string]any {
	command, args := b.Server(chat)
	return map[string]any{"mcp_servers": map[string]any{BrowserServer: map[string]any{
		"command": command, "args": args,
		"default_tools_approval_mode": "approve",
		"tool_timeout_sec":            browserToolTimeout,
	}}}
}

func (r *BrowserResult) validate() error {
	if len(r.Content) == 0 || len(r.Content) > maxBrowserContent {
		return errors.New("a browser result carries 1 to 16 content items")
	}
	size := 0
	for _, c := range r.Content {
		size += len(c.Text) + len(c.Data)
		switch c.Type {
		case "text":
			if c.Data != "" || c.MimeType != "" {
				return errors.New("browser text carries only text")
			}
		case "image":
			switch c.MimeType {
			case "image/png", "image/jpeg", "image/webp", "image/gif":
			default:
				return errors.New("unsupported browser image type")
			}
			if c.Text != "" || c.Data == "" {
				return errors.New("a browser image carries only its data")
			}
			if _, err := base64.StdEncoding.DecodeString(c.Data); err != nil {
				return errors.New("browser image is not base64")
			}
		default:
			return errors.New("unsupported browser content type")
		}
	}
	if size > maxBrowserResult {
		return errors.New("a browser result is limited to 2 MiB; send a smaller image or less text")
	}
	return nil
}

// Caller holds mu.
func (r *running) browserChanged() {
	close(r.browserWake)
	r.browserWake = make(chan struct{})
}

// Caller holds mu. A turn that ended, or a chat that stopped, can no longer
// take an answer: its waiting calls fail instead of reaching a later turn.
func (r *running) cancelBrowser() {
	if r.session.Browser == nil || len(r.browser) == 0 {
		return
	}
	for id, ch := range r.browser {
		close(ch)
		delete(r.browser, id)
	}
	r.session.Browser.Calls = []BrowserCall{}
	r.browserChanged()
}

// Caller holds mu.
func (r *running) dropBrowserCall(id string) {
	delete(r.browser, id)
	for i, c := range r.session.Browser.Calls {
		if c.ID == id {
			r.session.Browser.Calls = append(r.session.Browser.Calls[:i:i], r.session.Browser.Calls[i+1:]...)
			break
		}
	}
	r.browserChanged()
}

// BrowserTools lists the tools a chat's browser offered when it started.
func (m *Manager) BrowserTools(id string) ([]BrowserTool, error) {
	r, err := m.get(id)
	if err != nil {
		return nil, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.session.Browser == nil {
		return nil, errors.New("this chat has no browser")
	}
	return append([]BrowserTool{}, r.session.Browser.Tools...), nil
}

// BrowserCall hands one provider tool call to the chat's browser and waits
// for its answer. It never retries: an unanswered call fails.
func (m *Manager) BrowserCall(ctx context.Context, id, tool string, arguments json.RawMessage) (BrowserResult, error) {
	r, err := m.get(id)
	if err != nil {
		return BrowserResult{}, err
	}
	if len(arguments) == 0 || string(arguments) == "null" {
		arguments = json.RawMessage(`{}`)
	}
	var object map[string]json.RawMessage
	if len(arguments) > maxBrowserArguments || json.Unmarshal(arguments, &object) != nil {
		return BrowserResult{}, errors.New("browser arguments must be an object of at most 256 KiB")
	}
	var raw [8]byte
	if _, err = rand.Read(raw[:]); err != nil {
		return BrowserResult{}, err
	}
	call := BrowserCall{ID: hex.EncodeToString(raw[:]), Tool: tool, Arguments: append(json.RawMessage(nil), arguments...)}
	ch := make(chan BrowserResult, 1)
	r.mu.Lock()
	switch {
	case r.session.Browser == nil:
		err = errors.New("this chat has no browser")
	case r.session.State != "running" && r.session.State != "waiting":
		err = errors.New("browser tools run only during a turn")
	case len(r.browser) >= maxBrowserPending:
		err = errors.New("the browser is busy with earlier calls")
	default:
		err = errors.New("the browser did not offer " + tool)
		for _, t := range r.session.Browser.Tools {
			if t.Name == tool {
				err = nil
			}
		}
	}
	if err != nil {
		r.mu.Unlock()
		return BrowserResult{}, err
	}
	r.browser[call.ID] = ch
	r.session.Browser.Calls = append(r.session.Browser.Calls, call)
	r.browserChanged()
	r.mu.Unlock()

	timer := time.NewTimer(browserWait)
	defer timer.Stop()
	select {
	case result, ok := <-ch:
		if !ok {
			return BrowserResult{}, errors.New("the turn ended before the browser answered")
		}
		return result, nil
	case <-ctx.Done():
		err = ctx.Err()
	case <-timer.C:
		err = errors.New("no browser answered; open the Burf side panel in the browser and try again")
	}
	r.mu.Lock()
	if _, pending := r.browser[call.ID]; pending {
		r.dropBrowserCall(call.ID)
	}
	r.mu.Unlock()
	// An answer accepted just as the wait ended still belongs to the provider.
	select {
	case result, ok := <-ch:
		if ok {
			return result, nil
		}
	default:
	}
	return BrowserResult{}, err
}

// BrowserResult answers one pending call, once.
func (m *Manager) BrowserResult(id, call string, result BrowserResult) error {
	if err := result.validate(); err != nil {
		return err
	}
	r, err := m.get(id)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	ch := r.browser[call]
	if ch == nil {
		return errors.New("browser call is no longer pending")
	}
	r.dropBrowserCall(call)
	ch <- result
	return nil
}

// BrowserCalls returns the calls waiting for the browser, holding the request
// up to wait while there are none.
func (m *Manager) BrowserCalls(ctx context.Context, id string, wait time.Duration) ([]BrowserCall, error) {
	r, err := m.get(id)
	if err != nil {
		return nil, err
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	for {
		r.mu.Lock()
		if r.session.Browser == nil {
			r.mu.Unlock()
			return nil, errors.New("this chat has no browser")
		}
		calls := append([]BrowserCall{}, r.session.Browser.Calls...)
		changed := r.browserWake
		exited := r.session.State == "exited"
		r.mu.Unlock()
		if len(calls) > 0 || exited {
			return calls, nil
		}
		select {
		case <-changed:
		case <-timer.C:
			return calls, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// The provider may still ask before one of the bridge's own tools runs, for
// example a CLI without the approval setting. That request becomes an
// ordinary one-use approval. Every other elicitation stays unsupported.
func (r *running) browserApproval(p packet) {
	var v struct {
		ServerName      string  `json:"serverName"`
		ThreadID        string  `json:"threadId"`
		TurnID          *string `json:"turnId"`
		Mode            string  `json:"mode"`
		Message         string  `json:"message"`
		RequestedSchema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		} `json:"requestedSchema"`
	}
	err := json.Unmarshal(p.Params, &v)
	key := string(p.ID)
	r.mu.Lock()
	if err == nil && r.session.Browser != nil && v.ServerName == BrowserServer && v.ThreadID == r.session.ThreadID &&
		v.TurnID != nil && *v.TurnID != "" && *v.TurnID == r.session.TurnID && v.Mode == "form" &&
		len(v.RequestedSchema.Properties) == 0 && v.Message != "" && len(v.Message) <= maxText &&
		len(r.approvals) < 8 && r.approvals[key] == nil {
		r.approvals[key] = append(json.RawMessage(nil), p.ID...)
		r.session.Approvals = append(r.session.Approvals, Approval{ID: key, Kind: "browser", Detail: v.Message, elicitation: true})
		r.session.State = "waiting"
		r.mu.Unlock()
		return
	}
	reason := "Codex requested an unsupported interaction (" + clip(p.Method) + "). Chat stopped without granting permission."
	r.invalidate(reason)
	r.mu.Unlock()
	r.finish(reason)
}
