package desktop

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"strings"
)

// decode accepts only the fields a command owns. No command takes executable
// names, shell fragments, environment overrides or arbitrary file paths.
func decode(raw json.RawMessage, into any) error {
	if len(raw) == 0 || string(raw) == "null" {
		raw = json.RawMessage(`{}`)
	}
	if len(raw) > 128<<10 {
		return errors.New("desktop command arguments are too large")
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(into); err != nil {
		return err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return errors.New("desktop command requires one argument object")
	}
	return nil
}

func externalURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.User != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return errors.New("external links must be HTTP or HTTPS without credentials")
	}
	return nil
}

func deepLinks(args []string) []string {
	var links []string
	for _, arg := range args {
		if len(arg) > 8192 || !strings.HasPrefix(arg, "berth://") {
			continue
		}
		u, err := url.Parse(arg)
		if err == nil && u.Scheme == "berth" && u.User == nil {
			links = append(links, arg)
		}
	}
	return links
}
