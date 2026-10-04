package box

import (
	"fmt"
	"strings"
	"testing"
)

func TestCheckFeedbackKeepsWhatFailedWithinItsLimit(t *testing.T) {
	var b strings.Builder
	b.WriteString("\x1b[32mPASS\x1b[0m src/a.test.ts\n")
	b.WriteString("FAIL src/billing.test.ts > charges once\n  Expected: 1\n  Received: 2\n")
	for i := range 2000 {
		fmt.Fprintf(&b, "  ✓ unrelated test %d passed\n\n\n", i)
	}
	b.WriteString("Tests: 1 failed, 2000 passed\n")
	got := CheckFeedback(b.String(), 3000)
	if len(got) > 3000 {
		t.Fatalf("%d bytes", len(got))
	}
	for _, want := range []string{"FAIL src/billing.test.ts > charges once", "Expected: 1", "Tests: 1 failed, 2000 passed"} {
		if !strings.Contains(got, want) {
			t.Errorf("lacks %q:\n%s", want, got)
		}
	}
	if strings.Contains(got, "\x1b") || strings.Contains(got, "\n\n\n") {
		t.Error("kept colours or blank runs")
	}
	if short := CheckFeedback("tsc: error TS2304\n", 3000); short != "tsc: error TS2304" {
		t.Fatalf("short output = %q", short)
	}
}
