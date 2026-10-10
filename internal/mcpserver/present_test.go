package mcpserver

import (
	"context"
	"encoding/json"
	"github.com/MylesMCook/burf/internal/box"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPresentIsOfferedOnlyToOwnedChats(t *testing.T) {
	for _, chat := range []string{"", "c1"} {
		res := rpc(t, &Server{Chat: chat}, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
		found := false
		for _, tool := range res[0]["result"].(map[string]any)["tools"].([]any) {
			found = found || tool.(map[string]any)["name"] == "burf_present"
		}
		if found != (chat != "") {
			t.Fatalf("chat %q: present available=%v", chat, found)
		}
	}
}

type presentationBox struct {
	calls int
	body  string
}

func (f *presentationBox) Do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	return f.DoWithHeader(ctx, method, path, body, nil)
}
func (f *presentationBox) DoWithHeader(_ context.Context, method, path string, body io.Reader, _ http.Header) (*http.Response, error) {
	f.calls++
	raw, _ := io.ReadAll(body)
	f.body = string(raw)
	w := httptest.NewRecorder()
	if method != "POST" || path != "/v1/chats/c1/tools/present" {
		w.WriteHeader(404)
	} else {
		w.WriteString(`{"type":"chart","id":"present-owned","label":"Latency","value":"3ms","points":[1,3],"variant":"line"}`)
	}
	return w.Result(), nil
}

func TestPresentReturnsTypedResultAndTextFallbackWithoutArtifactOrApproval(t *testing.T) {
	f := &presentationBox{}
	res := rpc(t, &Server{Chat: "c1", Box: box.NewClient(f)}, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"burf_present","arguments":{"type":"chart","label":"Latency","value":"3ms","points":[1,3],"variant":"line"}}}`)
	result := res[0]["result"].(map[string]any)
	typed := result["structuredContent"].(map[string]any)
	text, failed := toolText(res[0])
	if f.calls != 1 || typed["id"] != "present-owned" || typed["type"] != "chart" || failed || !strings.Contains(text, "Latency: 3ms") {
		t.Fatal(res, f.calls, text)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(f.body), &body); err != nil || body["type"] != "chart" || body["id"] != nil {
		t.Fatal(f.body, err)
	}
}

func TestPresentRejectsExecutableOrUnknownPayloads(t *testing.T) {
	res := rpc(t, &Server{Chat: "c1"}, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"burf_present","arguments":{"type":"chart","label":"x","value":"1","points":[1],"html":"<script>bad</script>"}}}`)
	if res[0]["error"] != nil {
		t.Fatal("presentation must be a supported tool, with validation failure returned as tool error", res)
	}
	text, failed := toolText(res[0])
	if !failed || !strings.Contains(text, "unknown") {
		t.Fatal(text, failed)
	}
}
