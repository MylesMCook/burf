package uibundle

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"strings"
	"unicode/utf8"

	"golang.org/x/net/html"
)

// SnapshotHTML derives the main window's policy from the final trusted HTML,
// including framework-injected scripts and import maps. Call it after injection
// and send it as the response's Content-Security-Policy header. Browsing panes
// have separate native WebViews and never share this application policy.
func SnapshotHTML(finalHTML []byte) (string, error) {
	if !utf8.Valid(finalHTML) {
		return "", errors.New("invalid UTF-8 HTML")
	}
	hashes := make([]string, 0)
	seen := make(map[string]bool)
	z := html.NewTokenizer(bytes.NewReader(finalHTML))
	for {
		switch z.Next() {
		case html.ErrorToken:
			if err := z.Err(); err != io.EOF {
				return "", err
			}
			loopback := " http://localhost:* http://127.0.0.1:* http://[::1]:*"
			return "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'" + strings.Join(hashes, "") +
				"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com" + loopback +
				"; font-src 'self' data: blob:; connect-src 'self'" + loopback +
				" ws://localhost:* ws://127.0.0.1:* ws://[::1]:*; worker-src 'self' blob:; frame-src http://*.localhost:*" + loopback + " https:; object-src 'none'; base-uri 'self'; form-action 'self'", nil
		case html.StartTagToken, html.SelfClosingTagToken:
			name, _ := z.TagName()
			if string(name) != "script" {
				continue
			}
			// Text normalizes CRLF/CR exactly as the browser's HTML parser does,
			// preserving raw script and import-map contents without unescaping.
			if z.Next() != html.TextToken {
				continue
			}
			text := z.Text()
			if len(text) == 0 {
				continue
			}
			sum := sha256.Sum256(text)
			hash := " 'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
			if !seen[hash] {
				seen[hash] = true
				hashes = append(hashes, hash)
			}
		}
	}
}
