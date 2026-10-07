package proxy

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
)

func TestDevtoolsScriptGoesOnlyToAFrameThatAskedForIt(t *testing.T) {
	port := devPage(t)
	host := strconv.Itoa(port) + ".devl.localhost:1377"
	p := newProxy()

	// Normal browsing, and a frame that didn't ask: the page as sent.
	for _, h := range []http.Header{nil, iframe} {
		resp := get(t, p, host, "/", h)
		if body := read(t, resp); strings.Contains(body, "data-berth-devtools") {
			t.Errorf("unflagged page got the script: %s", body)
		}
		if resp.Header.Get("X-Frame-Options") != "SAMEORIGIN" {
			t.Error("unflagged page lost X-Frame-Options")
		}
	}

	// A Browser tab's frame that asked: the script in its head, the flag
	// never reaching the dev server, the page framable, and its policy
	// letting the script run.
	resp := get(t, p, host, "/?tab=2&"+DevtoolsParam+"=1", http.Header{"Sec-Fetch-Dest": {"iframe"}, "If-None-Match": {`"v1"`}})
	body := read(t, resp)
	if !strings.Contains(body, "<head><script data-berth-devtools>") || !strings.Contains(body, "__berthDevtools") {
		t.Fatalf("flagged page: %s", body)
	}
	if q := resp.Header.Get("X-Seen-Query"); q != "tab=2" {
		t.Errorf("dev server saw query %q", q)
	}
	if resp.Header.Get("X-Seen-Accept-Encoding") != "identity" || resp.Header.Get("X-Seen-If-None-Match") != "" {
		t.Error("flagged page was not asked for whole and plain")
	}
	if resp.Header.Get("X-Frame-Options") != "" {
		t.Error("X-Frame-Options kept")
	}
	csp := resp.Header.Get("Content-Security-Policy")
	if strings.Contains(csp, "frame-ancestors") || !strings.Contains(csp, "script-src 'self' "+devtoolsHash) {
		t.Errorf("policy %q", csp)
	}
	if resp.Header.Get("Cache-Control") != "no-store" {
		t.Error("the page with the script may be cached")
	}
	// It is not the preview script.
	if strings.Contains(body, "data-berth-preview") {
		t.Error("the preview script went in too")
	}

	// A top-level page with the flag (someone opened the address in a
	// browser) is left alone.
	if body := read(t, get(t, p, host, "/?"+DevtoolsParam+"=1", http.Header{"Sec-Fetch-Dest": {"document"}})); strings.Contains(body, "data-berth-devtools") {
		t.Error("a top-level page got the script")
	}
	// So is a JSON answer.
	if body := read(t, get(t, p, host, "/api?"+DevtoolsParam+"=1", iframe)); strings.Contains(body, "<script") {
		t.Errorf("JSON got the script: %s", body)
	}
}

func TestDevtoolsScriptIsTheOneTheAppRuns(t *testing.T) {
	js := DevtoolsScript()
	for _, want := range []string{"__berthDevtools", "berth-devtools:", "unhandledrejection", DevtoolsParam} {
		if !strings.Contains(js, want) {
			t.Errorf("script lacks %q", want)
		}
	}
	for _, line := range strings.Split(js, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "//") {
			t.Fatalf("comment left in: %q", line)
		}
	}
}
