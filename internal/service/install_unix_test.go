//go:build !windows

package service

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestInstallIsIdempotentAndDetectsItself(t *testing.T) {
	spec := spec
	for _, os_ := range []string{"darwin", "linux"} {
		_, calls := stub(t, os_)
		spec.LogPath = filepath.Join(t.TempDir(), "not-yet", "berth.log")
		if Installed(spec) {
			t.Fatalf("%s: installed before install", os_)
		}
		path, err := Install(spec)
		if _, statErr := os.Stat(filepath.Dir(spec.LogPath)); statErr != nil {
			t.Fatalf("%s: the log's folder was not made before the first start: %v", os_, statErr)
		}
		if err != nil {
			t.Fatalf("%s: %v", os_, err)
		}
		if !Installed(spec) {
			t.Fatalf("%s: not installed after install", os_)
		}
		other := spec
		other.Env = map[string]string{"BERTH_HOME": "/elsewhere"}
		if Installed(other) {
			t.Fatalf("%s: a unit for another home counted as installed", os_)
		}
		if _, err := Install(spec); err != nil {
			t.Fatalf("%s: reinstall: %v", os_, err)
		}
		entries, _ := os.ReadDir(filepath.Dir(path))
		if len(entries) != 1 {
			t.Fatalf("%s: install left extra files: %v", os_, entries)
		}
		if len(*calls) == 0 {
			t.Fatalf("%s: install did not load the unit", os_)
		}
		if _, err := Uninstall(spec); err != nil {
			t.Fatal(err)
		}
		if Installed(spec) {
			t.Fatalf("%s: still installed after uninstall", os_)
		}
	}
}

func TestInstallRefusesTemporaryAndRelativeBinaries(t *testing.T) {
	stub(t, "darwin")
	for _, program := range []string{filepath.Join(os.TempDir(), "berth"), "/Users/alex/Library/Caches/go-build/ab/berth", "bin/berth"} {
		s := spec
		s.Program = program
		if _, err := Install(s); err == nil {
			t.Errorf("installed %s", program)
		}
	}
}

// What Install writes, Read reads back: the agent finds a berthd the
// install script put on this computer this way.
func TestReadGivesBackWhatInstallWrote(t *testing.T) {
	for _, platform := range []string{"darwin", "linux"} {
		t.Run(platform, func(t *testing.T) {
			home, _ := stub(t, platform)
			s := Spec{
				Name:    BerthdName(),
				Program: "/Users/alex/Library/Application Support/berth/bin/berthd",
				Args:    []string{"serve", "--listen", "127.0.0.1:7445"},
				Env:     map[string]string{"BERTH_HOME": "/Users/alex/Library/Application Support/berth", "ODD": `a"b$c%d\e`},
				LogPath: filepath.Join(home, "box", "berthd.log"),
			}
			if _, ok, err := Read(s.Name); ok || err != nil {
				t.Fatalf("before install: ok=%v err=%v", ok, err)
			}
			path, err := Install(s)
			if err != nil {
				t.Fatal(err)
			}
			u, ok, err := Read(s.Name)
			if err != nil || !ok {
				t.Fatalf("Read: ok=%v err=%v", ok, err)
			}
			if u.Path != path || u.Program != s.Program || !reflect.DeepEqual(u.Args, s.Args) || !reflect.DeepEqual(u.Env, s.Env) {
				t.Fatalf("Read = %+v, want %+v", u, s)
			}
			if got := u.Arg("--listen"); got != "127.0.0.1:7445" {
				t.Fatalf("--listen = %q", got)
			}
		})
	}
}
