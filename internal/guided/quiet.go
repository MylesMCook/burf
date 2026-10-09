package guided

import "strings"

// The quiet install is what `burf add ssh` does by default, and the app's
// Add a box: no plan to read and no Enter to press. Every step that needs
// nothing from the person runs over SSH without a terminal; only a step
// that truly needs sudo's password (git missing, or lingering that the box
// won't allow without root) runs in a terminal, where sudo asks. The guided
// install (--guided) shows the plan first and
// runs every step in one terminal.

// LingerTry turns lingering on for the user without asking anything: with
// loginctl alone, which polkit allows for your own account on many boxes
// (Debian 12 with polkitd, Ubuntu with polkitd), else with sudo when sudo
// needs no password. It prints "linger yes" when lingering is on after it,
// and "linger no" when it needs a password (or root) to turn on.
const LingerTry = `u=$(id -un)
on() { [ "$(loginctl show-user "$u" -p Linger 2>/dev/null)" = Linger=yes ]; }
if ! on; then
  loginctl enable-linger "$u" >/dev/null 2>&1 || { sudo -n true >/dev/null 2>&1 && sudo -n loginctl enable-linger "$u" >/dev/null 2>&1; }
fi
if on; then echo 'linger yes'; else echo 'linger no'; fi
`

// LingerOn reads LingerTry's answer.
func LingerOn(out string) bool { return strings.Contains(out, "linger yes") }

// NeedsPassword reports whether a box step can only do its work with sudo
// asking for the person's password: it has something to do as root, the
// box has sudo, and sudo asks. A step that needs root on a box without sudo
// is not one: no terminal helps, and it stops with the command to run.
// Lingering counts as needing it only after LingerTry said no (p.Linger).
func NeedsPassword(step string, o Options, p Probe) bool {
	if p.UID == 0 || !p.Sudo || p.SudoNoPassword {
		return false
	}
	switch step {
	case StepLinger:
		return p.OS == "linux" && p.Linger != "yes"
	case StepTools:
		_, pkgs := toolsNeed(o, p)
		if len(pkgs) == 0 {
			return false
		}
		steps, brew := PackageSteps(p.Manager, pkgs)
		return steps != nil && !brew
	}
	return false
}

// AskLinger reports whether quiet mode asks the person about lingering
// before it asks for a password for it: when lingering is the only step
// that needs the password, it can be skipped (berthd then stops when the
// person logs out). When git needs the password too, lingering goes in
// the same terminal, so sudo asks once, and nothing is asked first.
func AskLinger(run []string, o Options, p Probe) bool {
	has := func(id string) bool {
		for _, s := range run {
			if s == id {
				return true
			}
		}
		return false
	}
	return has(StepLinger) && NeedsPassword(StepLinger, o, p) && !(has(StepTools) && NeedsPassword(StepTools, o, p))
}

// LingerQuestion is what quiet mode asks; Enter (or y) means yes.
func LingerQuestion(user string) string {
	return "Keep berthd running after you log out? It needs root: sudo asks for " + user + "'s password on the box. Skip it, and berthd stops when your last login there ends."
}

// LingerSkipped is the note for a skipped linger step.
func LingerSkipped(user string) string {
	return "skipped: berthd stops when you log out. To keep it running, run sudo loginctl enable-linger " + user + " on the box"
}

// Segment is a run of box steps that go together: in a terminal (sudo asks
// there) or without one.
type Segment struct {
	Steps    []string
	Terminal bool
}

// Segments splits the box steps to run, in order, into runs of steps that
// need a terminal and runs that don't. Steps keep their order, so a step
// that needs the password runs where the plan has it, and two such steps
// side by side (lingering, then git) share one terminal: sudo asks once.
func Segments(run []string, terminal func(step string) bool) []Segment {
	var out []Segment
	for _, s := range run {
		t := terminal(s)
		if n := len(out); n > 0 && out[n-1].Terminal == t {
			out[n-1].Steps = append(out[n-1].Steps, s)
			continue
		}
		out = append(out, Segment{Steps: []string{s}, Terminal: t})
	}
	return out
}
