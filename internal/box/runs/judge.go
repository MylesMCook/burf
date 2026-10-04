package runs

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// The judge ranks an attempts run's candidates. It never sees transcripts
// or whole diffs: each candidate is one line of diffstat and check status
// and its last commit subjects, and the judge reads the worktrees itself if
// it must. That keeps its prompt near 2 KB for three attempts.

// Verdict is what an agent judge must answer, as JSON.
type Verdict struct {
	Winner  int               `json:"winner"`
	Ranking []int             `json:"ranking"`
	Reasons map[string]string `json:"reasons"`
}

// JudgePrompt is the judge's prompt. Candidates are numbered from 1.
func JudgePrompt(task, criteria string, cands []Candidate) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Judge %d attempts at one task. Read-only: do not edit or run anything that changes files.\n", len(cands))
	if task != "" {
		fmt.Fprintf(&b, "Task: %s\n", clip(task, 300))
	}
	if criteria != "" {
		fmt.Fprintf(&b, "Criteria: %s\n", clip(criteria, 300))
	}
	b.WriteString("Attempts (read a worktree only if the summary is not enough):\n")
	for _, c := range cands {
		check := "check failed"
		if c.Verify.Passed {
			check = "check passed"
		}
		if c.Verify.Rounds > 0 {
			check += fmt.Sprintf(" in %d round(s)", c.Verify.Rounds)
		}
		fmt.Fprintf(&b, "%d. %s at %s: %s; %d files +%d -%d, %d commits.", c.Index+1, c.Agent, c.Path, check, c.Diff.Files, c.Diff.Added, c.Diff.Removed, c.Diff.Commits)
		if c.Summary != "" {
			fmt.Fprintf(&b, " Commits: %s", clip(c.Summary, 300))
		}
		b.WriteString("\n")
	}
	b.WriteString(`Reply with JSON only: {"winner": N, "ranking": [N, ...], "reasons": {"N": "one line"}}`)
	return b.String()
}

func clip(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > n {
		return s[:n] + "…"
	}
	return s
}

// ParseVerdict reads a judge's reply: the JSON object in it, checked
// against the schema for n candidates (numbered from 1).
func ParseVerdict(out string, n int) (Verdict, error) {
	i, j := strings.Index(out, "{"), strings.LastIndex(out, "}")
	if i < 0 || j < i {
		return Verdict{}, fmt.Errorf("no JSON object in the reply")
	}
	var raw struct {
		Winner  any            `json:"winner"`
		Ranking []any          `json:"ranking"`
		Reasons map[string]any `json:"reasons"`
	}
	if err := json.Unmarshal([]byte(out[i:j+1]), &raw); err != nil {
		return Verdict{}, fmt.Errorf("the reply is not JSON: %v", err)
	}
	num := func(v any) (int, bool) {
		switch t := v.(type) {
		case float64:
			return int(t), t == float64(int(t))
		case string:
			k, err := strconv.Atoi(strings.TrimSpace(t))
			return k, err == nil
		}
		return 0, false
	}
	var v Verdict
	w, ok := num(raw.Winner)
	if !ok || w < 1 || w > n {
		return Verdict{}, fmt.Errorf("winner must be a number from 1 to %d", n)
	}
	v.Winner = w
	seen := map[int]bool{}
	for _, r := range raw.Ranking {
		k, ok := num(r)
		if !ok || k < 1 || k > n || seen[k] {
			return Verdict{}, fmt.Errorf("ranking must list attempts 1 to %d once each", n)
		}
		seen[k] = true
		v.Ranking = append(v.Ranking, k)
	}
	if len(v.Ranking) == 0 {
		v.Ranking = []int{w}
	}
	v.Reasons = map[string]string{}
	for k, r := range raw.Reasons {
		v.Reasons[k] = clip(fmt.Sprint(r), 300)
	}
	return v, nil
}

// byCheck picks the passing candidate with the smallest diff.
func byCheck(cands []Candidate) (int, bool) {
	best := -1
	for i, c := range cands {
		if !c.Verify.Passed {
			continue
		}
		if best < 0 || c.Diff.Added+c.Diff.Removed < cands[best].Diff.Added+cands[best].Diff.Removed {
			best = i
		}
	}
	if best < 0 {
		return 0, false
	}
	return cands[best].Index, true
}

func (x *execution) judge(ctx context.Context, sc *scope, s Step, id, path string) (Result, error) {
	start := x.structuralStart(id, "judge", path)
	x.mu.Lock()
	cands := append([]Candidate(nil), x.run.Candidates...)
	x.mu.Unlock()
	sort.Slice(cands, func(i, j int) bool { return cands[i].Index < cands[j].Index })
	if len(cands) == 0 {
		return x.finishStructural(id, "judge", path, start, Result{Status: Failed, Err: "no candidates to judge"}), nil
	}
	by := s.By
	if by == "" {
		by = "check"
		if s.Agent != "" {
			by = "agent"
		}
	}
	set := map[string]string{}
	res := Result{Status: Succeeded, Set: set}
	winner := -1
	switch by {
	case "human":
		res.Out = "a person picks"
	case "check":
		if w, ok := byCheck(cands); ok {
			winner = w
			res.Out = fmt.Sprintf("attempt %d: its check passed with the smallest diff", w+1)
		} else {
			res.Status, res.Err, res.Out = Failed, "no attempt passed its check", "no attempt passed its check"
		}
	case "agent":
		prompt := JudgePrompt(sc.vars["params.prompt"], ExpandText(s.Text, sc.vars), cands)
		ask := Step{ID: id, Kind: "headless", Agent: s.Agent, Text: prompt, Timeout: s.Timeout, Diff: s.Diff}
		if ask.Agent == "" {
			ask.Agent = "claude"
		}
		if ask.Timeout == "" {
			ask.Timeout = "20m"
		}
		r, err := x.leaf(ctx, sc, ask, id, path+".ask")
		if err != nil {
			return Result{Status: Failed}, err
		}
		res.Usage = r.Usage
		v, perr := ParseVerdict(r.Out, len(cands))
		if perr != nil && r.ok() {
			// Once more, saying what was wrong; never the whole prompt again
			// in other words: the agent's own session already has it when
			// it can resume, and the retry is short.
			ask.Text = prompt + "\nYour last reply was not valid (" + perr.Error() + "). Reply with the JSON object only."
			r2, err := x.leaf(ctx, sc, ask, id, path+".ask2")
			if err != nil {
				return Result{Status: Failed}, err
			}
			v, perr = ParseVerdict(r2.Out, len(cands))
		}
		if perr != nil {
			res.Status, res.Err = Failed, "the judge's reply was not valid: "+perr.Error()
			if w, ok := byCheck(cands); ok {
				// Fall back to the checks, and say so.
				winner = w
				res.Status, res.Err = Succeeded, ""
				res.Out = fmt.Sprintf("the judge's reply was not valid (%v); by the checks, attempt %d", perr, w+1)
			}
			break
		}
		winner = v.Winner - 1
		x.mu.Lock()
		for i := range x.run.Candidates {
			c := &x.run.Candidates[i]
			c.Judge.Rank, c.Judge.Reason = 0, v.Reasons[strconv.Itoa(c.Index+1)]
			for rank, k := range v.Ranking {
				if k-1 == c.Index {
					c.Judge.Rank = rank + 1
				}
			}
		}
		ranked := append([]Candidate(nil), x.run.Candidates...)
		x.mu.Unlock()
		for _, c := range ranked {
			x.record(Record{T: recCandidate, Cand: &c}, false)
		}
		var b strings.Builder
		fmt.Fprintf(&b, "Winner: attempt %d.", v.Winner)
		if r := v.Reasons[strconv.Itoa(v.Winner)]; r != "" {
			b.WriteString(" " + r)
		}
		res.Out = b.String()
	}
	if winner >= 0 {
		set["judge.winner"] = strconv.Itoa(winner)
		var wc Candidate
		for _, c := range cands {
			if c.Index == winner {
				wc = c
			}
		}
		// Taken without a person only when its check passed.
		if s.Pick && wc.Verify.Passed {
			x.pick(sc, winner, set)
		}
	}
	return x.finishStructural(id, "judge", path, start, res), nil
}
