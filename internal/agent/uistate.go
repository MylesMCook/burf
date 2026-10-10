package agent

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	clientUIStateFile = "ui-state.json"
	maxClientUIState  = 32 << 20
	maxUIStorageValue = 1 << 20
	maxUIFontBytes    = 5 << 20
	maxUIStorageKeys  = 512
	maxUIFonts        = 128
	maxUIImages       = 8
	maxUIImageBytes   = 16 << 20
)

// ClientUIState is an explicit export from the old desktop origin. Credentials,
// provider state and arbitrary plugin storage are never part of the export.
// The old WebView storage remains the rollback source after import.
type ClientUIState struct {
	Version int               `json:"version"`
	Storage map[string]string `json:"storage"`
	Fonts   []ClientUIFont    `json:"fonts"`
	Images  []ClientUIImage   `json:"images"`
}

type ClientUIFont struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Bytes string `json:"bytes"`
}

type ClientUIImage struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Prompt string `json:"prompt,omitempty"`
	W      int    `json:"w"`
	H      int    `json:"h"`
	Type   string `json:"type"`
	At     int64  `json:"at"`
	Bytes  string `json:"bytes"`
}

var clientUIKeys = map[string]bool{
	"berth.prefs": true, "berth.ui": true, "berth.workspaces": true,
	"berth.notifications": true, "berth.editor": true, "berth.rail": true,
	"berth.sidebar": true, "berth.preview": true, "berth.worktreeTitles": true,
	"berth.homeBox": true, "berth.pluginScreens": true,
	"berth.files.recent": true, "berth.files.wrap": true, "berth.files.filter": true,
	"berth.runs.dismissed": true, "berth.runs.hiddenBoxes": true,
	"berth.worktrees.hiddenBoxes": true, "berth.worktrees.sort": true,
	"berth.worktrees.syncMode": true, "berth.review.comments": true,
	"berth.review.reviewed": true, "berth.automations.tab": true,
	"berth.automations.events": true, "berth.dashboard.hiddenBoxes": true,
	"berth.dashboard.cleanupAfter": true, "berth.newWorktree.project.v2": true,
	"berth.broadcast.wait": true, "berth.devtools.height": true,
	"berth.hooks.asked": true, "berth.serviceCloseTip": true,
	"berth.chat.permission": true, "berth.app-version": true,
	"berth.diff.mode": true, "berth.loops.folded": true,
}

var clientUIPrefixes = []string{
	"berth.composer.picks.", "berth.composer.default.", "berth.composer.providers.",
	"berth.composer.comparison.", "berth.newWorktree.box.", "berth.loop.check.",
	"berth.home.",
}

var clientUIFontID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
var clientUIImageID = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$`)

func isClientUIKey(key string) bool {
	if len(key) > 1024 || strings.IndexFunc(key, unicode.IsControl) >= 0 {
		return false
	}
	if clientUIKeys[key] {
		return true
	}
	for _, prefix := range clientUIPrefixes {
		if strings.HasPrefix(key, prefix) && len(key) > len(prefix) {
			return true
		}
	}
	return false
}

func validateClientUIState(state *ClientUIState) error {
	if state.Version != 1 || state.Storage == nil || state.Fonts == nil {
		return errors.New("the desktop state must have version 1, storage and fonts")
	}
	if len(state.Storage) > maxUIStorageKeys || len(state.Fonts) > maxUIFonts || len(state.Images) > maxUIImages {
		return errors.New("the desktop state has too many entries")
	}
	for key, value := range state.Storage {
		if !isClientUIKey(key) || len(value) > maxUIStorageValue || !utf8.ValidString(value) {
			return errors.New("the desktop state contains unsupported storage")
		}
	}
	seen := map[string]bool{}
	for _, font := range state.Fonts {
		if !clientUIFontID.MatchString(font.ID) || seen[font.ID] || len(font.Name) == 0 || len(font.Name) > 512 || strings.TrimSpace(font.Name) != font.Name || strings.IndexFunc(font.Name, unicode.IsControl) >= 0 {
			return errors.New("the desktop state contains an invalid font")
		}
		seen[font.ID] = true
		if len(font.Bytes) > base64.StdEncoding.EncodedLen(maxUIFontBytes) {
			return errors.New("a desktop font is over 5 MB")
		}
		bytes, err := base64.StdEncoding.Strict().DecodeString(font.Bytes)
		if err != nil || len(bytes) < 4 || len(bytes) > maxUIFontBytes || (string(bytes[:4]) != "wOFF" && string(bytes[:4]) != "wOF2") || base64.StdEncoding.EncodeToString(bytes) != font.Bytes {
			return errors.New("the desktop state contains an invalid WOFF font")
		}
	}
	// Earlier version-1 exports did not contain retained background images.
	if state.Images == nil {
		state.Images = []ClientUIImage{}
	}
	seen = map[string]bool{}
	for _, image := range state.Images {
		if !clientUIImageID.MatchString(image.ID) || seen[image.ID] || len(image.Name) == 0 || len(image.Name) > 2048 || len(image.Prompt) > maxUIStorageValue || !utf8.ValidString(image.Prompt) || image.W < 1 || image.W > 2560 || image.H < 1 || image.H > 2560 || image.At < 0 || image.At > 9007199254740991 {
			return errors.New("the desktop state contains an invalid background image")
		}
		seen[image.ID] = true
		if len(image.Bytes) > base64.StdEncoding.EncodedLen(maxUIImageBytes) {
			return errors.New("a desktop background image is over 16 MB")
		}
		bytes, err := base64.StdEncoding.Strict().DecodeString(image.Bytes)
		if err != nil || len(bytes) > maxUIImageBytes || base64.StdEncoding.EncodeToString(bytes) != image.Bytes || !clientUIImageSignature(image.Type, bytes) {
			return errors.New("the desktop state contains invalid background image bytes")
		}
	}
	return nil
}

func clientUIImageSignature(kind string, bytes []byte) bool {
	switch kind {
	case "image/jpeg":
		return len(bytes) >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff
	case "image/webp":
		return len(bytes) >= 12 && string(bytes[:4]) == "RIFF" && string(bytes[8:12]) == "WEBP"
	case "image/png":
		return len(bytes) >= 8 && string(bytes[:8]) == "\x89PNG\r\n\x1a\n"
	default:
		return false
	}
}

func decodeClientUIState(reader io.Reader) (*ClientUIState, error) {
	decoder := json.NewDecoder(reader)
	decoder.DisallowUnknownFields()
	var state ClientUIState
	if err := decoder.Decode(&state); err != nil {
		return nil, err
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return nil, errors.New("the desktop state must be one JSON document")
	}
	if err := validateClientUIState(&state); err != nil {
		return nil, err
	}
	return &state, nil
}

// uiStateRoutes belongs only on the authenticated local HTTP API. The caller
// supplies its existing loopback, token and origin checks.
func (a *Agent) uiStateRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/client/ui-state", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		state, err := LoadClientUIState(a.cfg.Dir)
		if err != nil {
			writeError(w, 500, "could not read the desktop state snapshot")
			return
		}
		writeJSON(w, 200, state)
	})
	mux.HandleFunc("POST /v1/client/ui-state", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		state, err := decodeClientUIState(http.MaxBytesReader(w, r.Body, maxClientUIState))
		if err != nil {
			writeError(w, 400, "invalid desktop state; use version 1, supported storage and saved files, at most 32 MB")
			return
		}
		done, err := a.work.begin("saving desktop state")
		if err != nil {
			writeCoded(w, 503, err.Error(), "agent_restarting")
			return
		}
		defer done()
		if err := saveClientUIState(a.cfg.Dir, state); err != nil {
			writeError(w, 500, "could not save the desktop state snapshot")
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
}

// LoadClientUIState reads only Burf's supported export, never a WebView profile.
// A nil snapshot means the old shell has not exported state on this computer.
func LoadClientUIState(dir string) (*ClientUIState, error) {
	root, err := clientUIRoot(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer root.Close()
	file, err := openClientUIFile(root, clientUIStateFile)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > maxClientUIState {
		return nil, errors.New("invalid desktop state file")
	}
	if err := clientUIOwner(file); err != nil {
		return nil, err
	}
	data, err := io.ReadAll(io.LimitReader(file, maxClientUIState+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxClientUIState {
		return nil, errors.New("desktop state file is over 32 MB")
	}
	return decodeClientUIState(strings.NewReader(string(data)))
}

func clientUIRoot(dir string) (*os.Root, error) {
	info, err := os.Lstat(dir)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return nil, errors.New("desktop state directory must not be a symbolic link")
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	file, err := root.Open(".")
	if err == nil {
		err = clientUIOwner(file)
		file.Close()
	}
	if err != nil {
		root.Close()
		return nil, err
	}
	return root, nil
}

func saveClientUIState(dir string, state *ClientUIState) error {
	if err := validateClientUIState(state); err != nil {
		return err
	}
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	if len(data) > maxClientUIState {
		return errors.New("desktop state is over 32 MB")
	}
	root, err := clientUIRoot(dir)
	if err != nil {
		return err
	}
	defer root.Close()
	if info, err := root.Lstat(clientUIStateFile); err == nil {
		if !info.Mode().IsRegular() {
			return errors.New("desktop state file must be a regular file")
		}
		file, err := openClientUIFile(root, clientUIStateFile)
		if err != nil {
			return err
		}
		err = clientUIOwner(file)
		file.Close()
		if err != nil {
			return err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	var suffix [16]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		return err
	}
	name := ".client-ui-state-" + hex.EncodeToString(suffix[:])
	file, err := createClientUIFile(root, name)
	if err != nil {
		return err
	}
	defer root.Remove(name)
	_, err = file.Write(data)
	if err == nil {
		err = file.Sync()
	}
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if err := root.Rename(name, clientUIStateFile); err != nil {
		return fmt.Errorf("replace desktop state: %w", err)
	}
	return nil
}
