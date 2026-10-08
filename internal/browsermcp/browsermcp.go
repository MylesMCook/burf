// Package browsermcp is `burfd browser-mcp`: the stdio MCP server a provider
// starts for one structured chat that was given browser tools. It keeps no
// state and opens no listener. It lists that chat's tools and forwards each
// call over the box's own socket, where the call waits for the browser of the
// client that started the chat (box/chatbrowser.go).
package browsermcp

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"sync"

	"github.com/MylesMCook/burf/internal/boxclient"
	"github.com/MylesMCook/burf/internal/version"
)

type request struct {
	ID     json.RawMessage `json:"id,omitempty"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

type content struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	Data     string `json:"data,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
}

type result struct {
	Content []content `json:"content"`
	IsError bool      `json:"isError,omitempty"`
}

// Serve answers MCP requests on in and out for one chat until in ends.
func Serve(ctx context.Context, box *boxclient.Client, chat string, in io.Reader, out io.Writer) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	base := "/v1/chats/" + url.PathEscape(chat) + "/browser/"
	var write sync.Mutex
	enc := json.NewEncoder(out)
	reply := func(id json.RawMessage, res any, err *rpcError) {
		write.Lock()
		defer write.Unlock()
		if err != nil {
			res = nil
		}
		_ = enc.Encode(response{JSONRPC: "2.0", ID: id, Result: res, Error: err})
	}
	// A call waits for a person's browser, so it must not hold up a ping or
	// another call. Calls end with the input: the box withdraws them.
	var calls sync.WaitGroup
	defer calls.Wait()
	defer cancel()
	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64<<10), 4<<20)
	for sc.Scan() {
		var req request
		if json.Unmarshal(sc.Bytes(), &req) != nil {
			reply(json.RawMessage("null"), nil, &rpcError{-32700, "parse error"})
			continue
		}
		if len(req.ID) == 0 {
			continue // a notification
		}
		switch req.Method {
		case "initialize":
			var p struct {
				ProtocolVersion string `json:"protocolVersion"`
			}
			_ = json.Unmarshal(req.Params, &p)
			if p.ProtocolVersion == "" {
				p.ProtocolVersion = "2025-06-18"
			}
			reply(req.ID, map[string]any{
				"protocolVersion": p.ProtocolVersion,
				"capabilities":    map[string]any{"tools": map[string]any{}},
				"serverInfo":      map[string]any{"name": "burf-browser", "version": version.Version},
				"instructions":    "These tools act in the user's own browser, in the tab they are looking at. The user approves each site. A refused or unanswered call is final: report it instead of retrying.",
			}, nil)
		case "ping":
			reply(req.ID, map[string]any{}, nil)
		case "tools/list":
			var listed struct {
				Tools []struct {
					Name        string          `json:"name"`
					Description string          `json:"description"`
					InputSchema json.RawMessage `json:"input_schema"`
				} `json:"tools"`
			}
			if err := box.Call(ctx, http.MethodGet, base+"tools", nil, &listed); err != nil {
				reply(req.ID, nil, &rpcError{-32603, err.Error()})
				continue
			}
			tools := []tool{}
			for _, t := range listed.Tools {
				tools = append(tools, tool{Name: t.Name, Description: t.Description, InputSchema: t.InputSchema})
			}
			reply(req.ID, map[string]any{"tools": tools}, nil)
		case "tools/call":
			var p struct {
				Name      string          `json:"name"`
				Arguments json.RawMessage `json:"arguments"`
			}
			if json.Unmarshal(req.Params, &p) != nil || p.Name == "" {
				reply(req.ID, nil, &rpcError{-32602, "invalid params"})
				continue
			}
			calls.Add(1)
			go func(id json.RawMessage) {
				defer calls.Done()
				var got struct {
					Content []struct {
						Type     string `json:"type"`
						Text     string `json:"text"`
						Data     string `json:"data"`
						MimeType string `json:"mime_type"`
					} `json:"content"`
					IsError bool `json:"is_error"`
				}
				err := box.Call(ctx, http.MethodPost, base+"calls", map[string]any{"tool": p.Name, "arguments": p.Arguments}, &got)
				if err != nil {
					reply(id, result{Content: []content{{Type: "text", Text: err.Error()}}, IsError: true}, nil)
					return
				}
				res := result{Content: []content{}, IsError: got.IsError}
				for _, c := range got.Content {
					res.Content = append(res.Content, content{Type: c.Type, Text: c.Text, Data: c.Data, MimeType: c.MimeType})
				}
				reply(id, res, nil)
			}(req.ID)
		default:
			reply(req.ID, nil, &rpcError{-32601, "method not found"})
		}
	}
	return sc.Err()
}
