package box

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/boxclient"
)

// A kit packages how a project is set up — scripts, environment, ports,
// services, hooks, flows, agents — so it can be applied to the same
// repository on many boxes, and shared as a link. It is its own layer in a
// location's config, between the repository's committed config and the
// box's own, so it can be updated or removed without touching either.

// Kit is a kit's manifest, kit.json.
type Kit = boxclient.Kit

type KitMatch = boxclient.KitMatch

type KitRequirement = boxclient.KitRequirement

// InstalledKit is a kit as a location has it.
type InstalledKit = boxclient.InstalledKit

var kitID = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,47}$`)

// KitInstall is a kit on its way to a box: the manifest, its files (path →
// base64), where it came from, and a hash of everything for updates.
type KitInstall = boxclient.KitInstall

// KitResult reports an install.
type KitResult = boxclient.KitResult

// cleanKitPath accepts a relative path that stays inside the kit's folder.
func cleanKitPath(p string) (string, error) {
	c := path.Clean(strings.ReplaceAll(p, `\`, "/"))
	if c == "." || strings.HasPrefix(c, "/") || c == ".." || strings.HasPrefix(c, "../") {
		return "", fmt.Errorf("kit file %q is outside the kit", p)
	}
	return c, nil
}

// InstallKit writes a kit's files on the box and installs its config for a
// location, replacing any kit the location had.
func (b *Box) InstallKit(ctx context.Context, location string, in KitInstall) (KitResult, error) {
	k := in.Kit
	if !kitID.MatchString(k.ID) {
		return KitResult{}, badRequest("kit id %q must be lowercase letters, digits and dashes", k.ID)
	}
	if strings.TrimSpace(k.Name) == "" {
		k.Name = k.ID
	}
	if err := validateConfig(k.Config); err != nil {
		return KitResult{}, badRequest("kit %s: %v", k.ID, err)
	}
	if b.KitsDir == "" {
		return KitResult{}, httpError{http.StatusNotImplemented, "this box has nowhere to keep kits"}
	}
	if _, err := b.Locations.saved(location); err != nil {
		return KitResult{}, err
	}
	files := map[string][]byte{}
	for p, content := range k.Files {
		c, err := cleanKitPath(p)
		if err != nil {
			return KitResult{}, badRequest("%v", err)
		}
		files[c] = []byte(content)
	}
	for p, enc := range in.Files {
		c, err := cleanKitPath(p)
		if err != nil {
			return KitResult{}, badRequest("%v", err)
		}
		data, err := base64.StdEncoding.DecodeString(enc)
		if err != nil {
			return KitResult{}, badRequest("kit file %s is not base64", p)
		}
		files[c] = data
	}

	dir := filepath.Join(b.KitsDir, location, k.ID)
	tmp := dir + ".new"
	os.RemoveAll(tmp)
	for p, data := range files {
		full := filepath.Join(tmp, filepath.FromSlash(p))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			return KitResult{}, err
		}
		mode := os.FileMode(0o644)
		if strings.HasPrefix(string(data), "#!") {
			mode = 0o755
		}
		if err := os.WriteFile(full, data, mode); err != nil {
			return KitResult{}, err
		}
	}
	os.MkdirAll(tmp, 0o755)
	os.RemoveAll(dir)
	if err := os.Rename(tmp, dir); err != nil {
		return KitResult{}, err
	}

	installed := InstalledKit{ID: k.ID, Name: k.Name, Version: k.Version, Source: in.Source, Hash: in.Hash, Dir: dir, Config: k.Config, InstalledAt: time.Now().UTC()}
	if err := b.Locations.setKit(location, &installed); err != nil {
		return KitResult{}, err
	}
	res := KitResult{Kit: installed, Warnings: []string{}}
	for _, r := range k.Requires {
		if _, ok := findTool(ctx, r.Tool); !ok {
			res.Warnings = append(res.Warnings, toolWarning(r.Tool, r.Hint))
		}
	}
	return res, nil
}

// RemoveKit removes a location's kit and its files.
func (b *Box) RemoveKit(location string) (InstalledKit, error) {
	saved, err := b.Locations.saved(location)
	if err != nil {
		return InstalledKit{}, err
	}
	if saved.Kit == nil {
		return InstalledKit{}, httpError{http.StatusNotFound, location + " has no kit"}
	}
	if err := b.Locations.setKit(location, nil); err != nil {
		return InstalledKit{}, err
	}
	os.RemoveAll(saved.Kit.Dir)
	return *saved.Kit, nil
}

func (l *Locations) setKit(name string, k *InstalledKit) error {
	return l.update(func(all []savedLocation) ([]savedLocation, error) {
		for i := range all {
			if all[i].Name == name {
				all[i].Kit = k
				return all, nil
			}
		}
		return nil, ErrUnknownLocation
	})
}

func (b *Box) putKit(w http.ResponseWriter, r *http.Request) error {
	var in KitInstall
	// Kits carry their scripts, so they get more room than other requests.
	if err := decodeLimit(r, &in, 8<<20); err != nil {
		return err
	}
	location := r.PathValue("name")
	if err := b.before(r, "kit.install", map[string]any{"location": location, "kit": in.Kit.ID, "source": in.Source}); err != nil {
		return err
	}
	res, err := b.InstallKit(r.Context(), location, in)
	if err != nil {
		return err
	}
	b.publish(r, "kit.installed", map[string]any{"location": location, "kit": res.Kit.ID, "version": res.Kit.Version, "source": res.Kit.Source, "warnings": res.Warnings})
	writeJSON(w, res)
	return nil
}

func (b *Box) deleteKit(w http.ResponseWriter, r *http.Request) error {
	location := r.PathValue("name")
	if err := b.before(r, "kit.remove", map[string]any{"location": location}); err != nil {
		return err
	}
	k, err := b.RemoveKit(location)
	if err != nil {
		return err
	}
	b.publish(r, "kit.removed", map[string]any{"location": location, "kit": k.ID})
	writeJSON(w, k)
	return nil
}

// InstalledKitAt is one location's kit, for listing a box's kits.
type InstalledKitAt = boxclient.InstalledKitAt

func (b *Box) listKits(w http.ResponseWriter, r *http.Request) error {
	all, err := b.Locations.read()
	if err != nil {
		return err
	}
	out := []InstalledKitAt{}
	for _, s := range all {
		if s.Kit != nil {
			out = append(out, InstalledKitAt{Location: s.Name, Slug: slugOf(remoteURL(r.Context(), s.Path)), Kit: *s.Kit})
		}
	}
	writeJSON(w, out)
	return nil
}
