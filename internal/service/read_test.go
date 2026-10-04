package service

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

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

func TestBerthdNameIsTheLaunchdLabelOnAMac(t *testing.T) {
	stub(t, "darwin")
	if BerthdName() != "dev.berth.berthd" {
		t.Fatal(BerthdName())
	}
	stub(t, "linux")
	if BerthdName() != "berthd" {
		t.Fatal(BerthdName())
	}
}

func TestReadRefusesAPlistWithoutAProgram(t *testing.T) {
	home, _ := stub(t, "darwin")
	path := filepath.Join(home, "Library", "LaunchAgents", "x.plist")
	os.MkdirAll(filepath.Dir(path), 0o755)
	os.WriteFile(path, []byte(`<?xml version="1.0"?><plist><dict><key>Label</key><string>x</string></dict></plist>`), 0o644)
	if _, _, err := Read("x"); err == nil {
		t.Fatal("a plist with no ProgramArguments was read")
	}
}
