// Package transport limits the native toolbar to the local companion's feedback API.
package transport

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const maxBody = 1 << 20

type Bridge struct {
	endpoint string
	server   *http.Server
	client   *http.Transport
	once     sync.Once
}

// Start binds an ephemeral loopback port. The returned endpoint includes a
// random capability which must only be returned through the guarded native binding.
func Start(companionURL, nativeOrigin string) (*Bridge, error) {
	target, err := companion(companionURL)
	if err != nil {
		return nil, err
	}
	if !validOrigin(nativeOrigin) {
		return nil, errors.New("unsupported native feedback origin")
	}
	capability := make([]byte, 16)
	if _, err := rand.Read(capability); err != nil {
		return nil, err
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	prefix := "/" + hex.EncodeToString(capability)
	client := &http.Transport{
		Proxy:                 nil,
		DialContext:           (&net.Dialer{Timeout: 3 * time.Second}).DialContext,
		ResponseHeaderTimeout: 3 * time.Second,
		IdleConnTimeout:       30 * time.Second,
		MaxIdleConnsPerHost:   4,
	}
	server := &http.Server{
		Handler:           handler(target, prefix, listener.Addr().String(), nativeOrigin, client),
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       10 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	bridge := &Bridge{endpoint: "http://" + listener.Addr().String() + prefix, server: server, client: client}
	go func() { _ = server.Serve(listener) }()
	return bridge, nil
}

func validOrigin(origin string) bool {
	for _, base := range []string{"wails://localhost", "http://wails.localhost"} {
		if origin == base {
			return true
		}
		if !strings.HasPrefix(origin, base+":") {
			continue
		}
		rawPort := strings.TrimPrefix(origin, base+":")
		port, err := strconv.Atoi(rawPort)
		return err == nil && port >= 1024 && port <= 65535 && rawPort == strconv.Itoa(port)
	}
	return false
}

func Endpoint(bridge *Bridge) string {
	if bridge == nil {
		return ""
	}
	return bridge.endpoint
}

func Stop(bridge *Bridge) {
	if bridge == nil {
		return
	}
	bridge.once.Do(func() {
		_ = bridge.server.Close() // Close active SSE streams as well as the listener.
		bridge.client.CloseIdleConnections()
	})
}

func companion(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return nil, errors.New("invalid feedback companion URL")
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil || port < 1024 || port > 65535 || u.Scheme != "http" || u.Hostname() != "127.0.0.1" || u.Host != "127.0.0.1:"+strconv.Itoa(port) || u.User != nil || u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
		return nil, errors.New("feedback companion must be http://127.0.0.1 with an explicit unprivileged port")
	}
	return u, nil
}

// Only the pinned toolbar's routes are forwarded. Listing sessions, MCP,
// global event feeds, account settings and annotation resolution remain private.
func methods(path string) string {
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if path == "/health" {
		return "GET"
	}
	if path == "/sessions" {
		return "POST"
	}
	if len(parts) < 2 || !id(parts[1]) {
		return ""
	}
	switch parts[0] {
	case "sessions":
		if len(parts) == 2 {
			return "GET"
		}
		if len(parts) == 3 && parts[2] == "annotations" {
			return "POST"
		}
		if len(parts) == 3 && parts[2] == "events" {
			return "GET"
		}
	case "annotations":
		if len(parts) == 2 {
			return "PATCH, DELETE"
		}
	}
	return ""
}

func id(value string) bool {
	if value == "" || len(value) > 128 {
		return false
	}
	for _, c := range value {
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' {
			continue
		}
		return false
	}
	return true
}

func handler(target *url.URL, prefix, host, nativeOrigin string, client *http.Transport) http.Handler {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(p *httputil.ProxyRequest) {
			p.Out.URL.Path = strings.TrimPrefix(p.In.URL.Path, prefix)
			p.Out.URL.RawPath = ""
			p.SetURL(target)
			p.Out.Host = target.Host
			p.Out.Header = make(http.Header)
			for _, key := range []string{"Content-Type", "Accept", "Last-Event-ID"} {
				for _, value := range p.In.Header.Values(key) {
					p.Out.Header.Add(key, value)
				}
			}
		},
		Transport:     client,
		FlushInterval: -1,
		ModifyResponse: func(r *http.Response) error {
			if r.StatusCode >= 300 && r.StatusCode < 400 {
				return errors.New("feedback redirects are not allowed")
			}
			for key := range r.Header {
				if strings.HasPrefix(strings.ToLower(key), "access-control-") || strings.EqualFold(key, "Set-Cookie") {
					r.Header.Del(key)
				}
			}
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
			http.Error(w, "feedback companion is unavailable", http.StatusBadGateway)
		},
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != host || !strings.HasPrefix(r.URL.Path, prefix+"/") || r.URL.RawPath != "" || r.URL.RawQuery != "" || r.URL.ForceQuery {
			http.NotFound(w, r)
			return
		}
		origin := r.Header.Get("Origin")
		if origin != "" && origin != nativeOrigin {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, prefix)
		allowed := methods(path)
		if allowed == "" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", nativeOrigin)
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			if origin == "" || !strings.Contains(", "+allowed+", ", ", "+r.Header.Get("Access-Control-Request-Method")+", ") {
				http.Error(w, "preflight not allowed", http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Methods", allowed)
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if !strings.Contains(", "+allowed+", ", ", "+r.Method+", ") {
			w.Header().Set("Allow", allowed)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !(r.Method == http.MethodGet && strings.HasSuffix(path, "/events")) {
			ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
			defer cancel()
			r = r.WithContext(ctx)
		}
		if r.Body != nil {
			body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
			_ = r.Body.Close()
			if err != nil {
				http.Error(w, "feedback body is too large or unreadable", http.StatusRequestEntityTooLarge)
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(body))
			r.ContentLength = int64(len(body))
		}
		proxy.ServeHTTP(w, r)
	})
}
