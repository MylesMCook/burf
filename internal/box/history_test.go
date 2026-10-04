package box

import "testing"

// Screens as Claude Code 2.1 draws them, read with -e for colours.
const (
	ghostPrompt = "\x1b[38;5;246m\x1b[48;5;237m❯ \x1b[38;5;231mRemember: apple.\x1b[39m\n\x1b[39m❯ \x1b[2mList the words I asked you to remember.\x1b[0m\n  Opus 5.5 · context 5%\n"
	typedPrompt = "\x1b[38;5;246m\x1b[48;5;237m❯ \x1b[38;5;231mRemember: apple.\x1b[39m\n\x1b[39m❯ Remember: plum. Reply OK.\n  Opus 5.5 · context 5%\n"
	emptyPrompt = "❯ Remember: apple.\n❯ \n  Opus 5.5\n"
	pickerUp    = `❯ Remember: apple. Reply OK.
   Rewind
   Restore the code and/or conversation to the point before…
     Remember: apple. Reply OK.
     No code changes
   ❯ Remember: plum. Reply OK.
     No code changes
     (current)
   Enter to continue · Esc to cancel
`
	confirm = `   Rewind
   Confirm you want to restore to the point before you sent this message:
   │ Remember: plum. Reply OK.
   The conversation will be forked.
   ❯ 1. Restore code and conversation
     2. Restore conversation
     3. Restore code
     4. Never mind
`
)

func TestTypedInPrompt(t *testing.T) {
	for sc, want := range map[string]bool{ghostPrompt: false, typedPrompt: true, emptyPrompt: false} {
		if got := typedInPrompt(sc); got != want {
			t.Errorf("typedInPrompt(%q) = %v", sc, got)
		}
	}
}

func TestRewindListReading(t *testing.T) {
	if got := pickedLine(pickerUp); got != "Remember: plum. Reply OK." {
		t.Fatalf("picked = %q", got)
	}
	if !samePrompt("Remember: plum. Reply OK.", pickerText("Remember:  plum.\nReply OK.")) {
		t.Fatal("same prompt, spaced differently")
	}
	if !samePrompt("Refactor the payment webhook so that…", pickerText("Refactor the payment webhook so that retries are safe")) {
		t.Fatal("a cut prompt")
	}
	if samePrompt("OK", "OK then do the rest") {
		t.Fatal("a short line is not a prefix match")
	}
	opts := menuOptions(confirm)
	if opts["Restore conversation"] != "2" || opts["Restore code and conversation"] != "1" || opts["Restore code"] != "3" {
		t.Fatalf("options = %v", opts)
	}
}

func TestMenuOptionsTakeNoBreakSpaces(t *testing.T) {
	sc := rewindConfirm + "\n❯ 1. Restore code and conversation\n  2. Restore conversation\n"
	got := menuOptions(sc)
	if got["Restore code and conversation"] != "1" || got["Restore conversation"] != "2" {
		t.Fatalf("menuOptions = %v", got)
	}
}
