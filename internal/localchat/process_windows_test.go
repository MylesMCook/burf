package localchat

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"

	"golang.org/x/sys/windows"
)

func TestMain(m *testing.M) {
	if os.Getenv("BURF_SYNTHETIC_APP_SERVER") == "1" && len(os.Args) > 1 {
		if os.Args[1] == "synthetic-child" {
			for {
				time.Sleep(time.Hour)
			}
		}
		if os.Args[1] == "app-server" {
			child := backgroundcmd.CommandContext(context.Background(), os.Args[0], "synthetic-child")
			if err := child.Start(); err != nil {
				os.Exit(3)
			}
			fmt.Println(child.Process.Pid)
			scanner := bufio.NewScanner(os.Stdin)
			for scanner.Scan() {
				if scanner.Text() == "environment" {
					fmt.Println(os.Getenv("BURF_TEST_VALUE"))
					continue
				}
				fmt.Println(scanner.Text())
			}
			os.Exit(0)
		}
	}
	os.Exit(m.Run())
}

func TestNativeStdioOwnsDescendantsAndPipes(t *testing.T) {
	t.Setenv("BURF_SYNTHETIC_APP_SERVER", "1")
	t.Setenv("BURF_TEST_VALUE", "wrong-inherited-account")
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	p, err := StartProcess(LaunchOptions{Program: exe, CWD: t.TempDir(), Env: append(os.Environ(), "BURF_TEST_VALUE=project-account")})
	if err != nil {
		t.Fatal(err)
	}
	defer p.Close()
	scanner := bufio.NewScanner(p)
	if !scanner.Scan() {
		t.Fatal("child PID", scanner.Err())
	}
	pid, err := strconv.Atoi(strings.TrimSpace(scanner.Text()))
	if err != nil {
		t.Fatal(err)
	}
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		t.Fatal(err)
	}
	defer windows.CloseHandle(handle)
	if _, err = p.Write([]byte("environment\n")); err != nil {
		t.Fatal(err)
	}
	if !scanner.Scan() || scanner.Text() != "project-account" {
		t.Fatal("project environment not applied", scanner.Text(), scanner.Err())
	}
	if _, err = p.Write([]byte("synthetic-json-line\n")); err != nil {
		t.Fatal(err)
	}
	if !scanner.Scan() || scanner.Text() != "synthetic-json-line" {
		t.Fatal("stdio was modified", scanner.Text(), scanner.Err())
	}
	if err = p.Close(); err != nil {
		t.Fatal(err)
	}
	state, err := windows.WaitForSingleObject(handle, 5000)
	if err != nil || state != windows.WAIT_OBJECT_0 {
		t.Fatalf("owned child survived: %v %v", state, err)
	}
}

func TestEnvironmentBlock(t *testing.T) {
	block, err := environmentBlock(nil)
	if err != nil || block != nil {
		t.Fatal("nil must inherit", block, err)
	}
	block, err = environmentBlock([]string{})
	if err != nil || len(block) != 2 || block[0] != 0 || block[1] != 0 {
		t.Fatal("empty must clear", block, err)
	}
	for _, entries := range [][]string{{"NO_VALUE"}, {"=invalid"}, {"PATH=contains\x00nul"}} {
		if _, err := environmentBlock(entries); err == nil {
			t.Fatal("accepted invalid environment", entries)
		}
	}
	block, err = environmentBlock([]string{"Path=old", "PATH=new", "=C:=C:\\", "ACCOUNT=project"})
	if err != nil {
		t.Fatal(err)
	}
	want := "=C:=C:\\\x00ACCOUNT=project\x00PATH=new\x00\x00"
	var chars []rune
	for _, char := range block {
		chars = append(chars, rune(char))
	}
	if string(chars) != want {
		t.Fatalf("block %q; want %q", string(chars), want)
	}
}
