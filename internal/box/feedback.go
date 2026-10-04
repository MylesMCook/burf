package box

import (
	"regexp"
	"strings"
)

// What a loop feeds back to an agent costs it tokens on every round, so it
// is the part of a failed check that says what failed, never the whole log.

var (
	ansiEscape  = regexp.MustCompile(`\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07`)
	failingLine = regexp.MustCompile(`(?i)(\bfail(ed|ure|ing)?\b|\berror\b|panic|\bexpected\b|assert|✗|✘|×|\bnot ok\b|undefined|cannot find|exception|traceback|\bTS\d{4}\b)`)
)

// CheckFeedback trims a check's output to at most limit bytes: the lines
// that say what failed (up to half of it), then the end of the output.
// Colours and runs of blank lines go.
func CheckFeedback(out string, limit int) string {
	if limit <= 0 {
		limit = 3000
	}
	out = ansiEscape.ReplaceAllString(out, "")
	out = strings.ReplaceAll(out, "\r\n", "\n")
	var lines []string
	blank := false
	for _, l := range strings.Split(out, "\n") {
		l = strings.TrimRight(l, " \t\r")
		if l == "" {
			if blank {
				continue
			}
			blank = true
		} else {
			blank = false
		}
		lines = append(lines, l)
	}
	joined := strings.TrimSpace(strings.Join(lines, "\n"))
	if len(joined) <= limit {
		return joined
	}
	clip := func(l string) string {
		if len(l) > 240 {
			return l[:240] + "…"
		}
		return l
	}
	var head []string
	used := 0
	seen := map[string]bool{}
	tailFrom := len(lines)
	// The tail first, so the failing lines picked are the ones it lacks.
	var tail []string
	budget := limit / 2
	for i := len(lines) - 1; i >= 0; i-- {
		l := clip(lines[i])
		if used+len(l)+1 > budget {
			break
		}
		tail = append([]string{l}, tail...)
		used += len(l) + 1
		tailFrom = i
	}
	for i := 0; i < tailFrom; i++ {
		l := clip(strings.TrimSpace(lines[i]))
		if l == "" || seen[l] || !failingLine.MatchString(l) {
			continue
		}
		if used+len(l)+1 > limit-8 {
			break
		}
		seen[l] = true
		head = append(head, l)
		used += len(l) + 1
	}
	parts := head
	if len(parts) > 0 {
		parts = append(parts, "…")
	} else {
		parts = []string{"…"}
	}
	return strings.Join(append(parts, tail...), "\n")
}
