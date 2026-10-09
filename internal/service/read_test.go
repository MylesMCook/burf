package service

import (
	"os"
	"path/filepath"
	"testing"
)

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
