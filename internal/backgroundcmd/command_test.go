package backgroundcmd

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"testing"
	"time"
)

func TestBackgroundChild(t *testing.T) {
	switch os.Getenv("BERTH_BACKGROUND_CHILD") {
	case "output":
		assertNoConsole(t)
		if t.Failed() {
			os.Exit(1)
		}
		fmt.Fprint(os.Stdout, "background stdout")
		fmt.Fprint(os.Stderr, "background stderr")
		os.Exit(7)
	case "wait":
		time.Sleep(30 * time.Second)
		os.Exit(0)
	}
}

func helper(t *testing.T, ctx context.Context, mode string) *exec.Cmd {
	t.Helper()
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	cmd := CommandContext(ctx, self, "-test.run=^TestBackgroundChild$")
	cmd.Env = append(os.Environ(), "BERTH_BACKGROUND_CHILD="+mode)
	return cmd
}

func TestBackgroundOutputAndExit(t *testing.T) {
	cmd := helper(t, context.Background(), "output")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	var exit *exec.ExitError
	if !errors.As(err, &exit) || exit.ExitCode() != 7 {
		t.Fatalf("exit: %v; stdout=%s stderr=%s", err, out, stderr.String())
	}
	if string(out) != "background stdout" || stderr.String() != "background stderr" {
		t.Fatalf("output changed: %q / %q", out, stderr.String())
	}
}

func TestBackgroundCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cmd := helper(t, ctx, "wait")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	cancel()
	if err := cmd.Wait(); err == nil || ctx.Err() == nil {
		t.Fatalf("canceled command returned %v", err)
	}
}
