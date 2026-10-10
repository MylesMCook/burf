package desktop

import (
	"bytes"
	"errors"
	"mime"
	"net/http"
	"strings"

	"github.com/MylesMCook/burf/internal/uibundle"
)

// AssetMiddleware sees the completed HTML after Wails injects its scripts.
// Runtime calls reject foreign browser origins before reaching the SDK bridge.
// The installed interface is already an immutable, verified fs.FS snapshot.
func AssetMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/wails/") {
			if !trustedRuntimeOrigin(r) {
				http.Error(w, "desktop runtime requires the Burf page origin", http.StatusForbidden)
				return
			}
			if r.URL.Path == "/wails/runtime" {
				if r.Method != http.MethodPost {
					w.Header().Set("Allow", http.MethodPost)
					http.Error(w, "desktop runtime requires POST", http.StatusMethodNotAllowed)
					return
				}
				contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
				if err != nil || contentType != "application/json" || r.Header.Get("Sec-Fetch-Mode") == "no-cors" {
					http.Error(w, "desktop runtime requires a JSON request", http.StatusUnsupportedMediaType)
					return
				}
			}
			next.ServeHTTP(w, r)
			return
		}
		capture := &assetResponse{header: make(http.Header)}
		next.ServeHTTP(capture, r)
		if capture.failed {
			http.Error(w, "desktop asset exceeds the response limit", http.StatusInternalServerError)
			return
		}
		contentType, _, _ := mime.ParseMediaType(capture.header.Get("Content-Type"))
		if contentType == "text/html" {
			switch r.Header.Get("Sec-Fetch-Dest") {
			case "iframe", "frame", "object", "embed":
				http.Error(w, "the Burf application page cannot be embedded", http.StatusForbidden)
				return
			}
			// This marker belongs only to the trusted top-level application page.
			// Runtime npm imports also create _wails in ordinary browsers.
			body := capture.body.Bytes()
			marker := []byte("<script>if(window.top===window){window.__BURF_WAILS__=true}</script>")
			at := bytes.Index(bytes.ToLower(body), []byte("<head>"))
			if at < 0 {
				http.Error(w, "desktop HTML has no head", http.StatusInternalServerError)
				return
			}
			body = append(append(append([]byte(nil), body[:at+6]...), marker...), body[at+6:]...)
			capture.body.Reset()
			_, _ = capture.body.Write(body)
			capture.header.Del("Content-Length")
			policy, err := uibundle.SnapshotHTML(capture.body.Bytes())
			if err != nil {
				http.Error(w, "desktop HTML policy could not be constructed", http.StatusInternalServerError)
				return
			}
			capture.header.Set("Content-Security-Policy", policy+"; frame-ancestors 'none'")
			capture.header.Set("X-Frame-Options", "DENY")
			capture.header.Set("X-Content-Type-Options", "nosniff")
		}
		for key, values := range capture.header {
			w.Header()[key] = values
		}
		status := capture.status
		if status == 0 {
			status = http.StatusOK
		}
		w.WriteHeader(status)
		_, _ = w.Write(capture.body.Bytes())
	})
}

type assetResponse struct {
	header http.Header
	body   bytes.Buffer
	status int
	failed bool
}

func (w *assetResponse) Header() http.Header { return w.header }
func (w *assetResponse) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
}
func (w *assetResponse) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	if w.header.Get("Content-Type") == "" {
		w.header.Set("Content-Type", http.DetectContentType(p))
	}
	if w.body.Len()+len(p) > 32<<20 {
		w.failed = true
		return 0, errors.New("asset exceeds response limit")
	}
	return w.body.Write(p)
}
