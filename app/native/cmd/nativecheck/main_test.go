package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResultReceiverRequiresTheSyntheticKeyAndBoundedObject(t *testing.T) {
	s := &smoke{reports: make(chan pageReport, 8)}
	handler := s.handler("synthetic-key")
	for _, test := range []struct {
		name, method, path, body string
		status                   int
	}{
		{"wrong key", "POST", "/report/other", `{"phase":"raw","checks":{"isolated":true}}`, http.StatusNotFound},
		{"wrong method", "GET", "/report/synthetic-key", "", http.StatusNotFound},
		{"unrecognized payload", "POST", "/report/synthetic-key", `{"phase":"raw","checks":{"isolated":true},"token":"secret"}`, http.StatusBadRequest},
		{"oversized body", "POST", "/report/synthetic-key", `{"phase":"raw","checks":{"isolated":true}}` + strings.Repeat(" ", 4096), http.StatusBadRequest},
		{"second object", "POST", "/report/synthetic-key", `{"phase":"raw","checks":{"isolated":true}} {}`, http.StatusBadRequest},
		{"unknown phase", "POST", "/report/synthetic-key", `{"phase":"other","checks":{"isolated":true}}`, http.StatusBadRequest},
		{"bounded result", "POST", "/report/synthetic-key", `{"phase":"raw","checks":{"isolated":true}}`, http.StatusNoContent},
	} {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest(test.method, "http://127.0.0.1"+test.path, strings.NewReader(test.body))
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != test.status {
				t.Fatalf("status %d, want %d", w.Code, test.status)
			}
		})
	}
	if len(s.reports) != 1 {
		t.Fatalf("accepted %d results, want one", len(s.reports))
	}
}

func TestMissingNativeAssertionsCannotPass(t *testing.T) {
	if allChecks(map[string]bool{"bootstrap": true}) || allChecks(nil) {
		t.Fatal("an incomplete native run passed")
	}
}
