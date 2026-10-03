package box

import (
	"encoding/json"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// How a flow's {{variables}} reach each kind of field. Their values come
// from events (a PR's title, a review comment, a branch name) and from what
// earlier steps printed, so none of them may ever become code:
//
//   - A run step's command never contains a value. Every variable is in the
//     command's environment as BERTH_FLOW_<NAME> ({{event.body}} is
//     BERTH_FLOW_EVENT_BODY), and {{x}} becomes a quoted reference to it,
//     "$BERTH_FLOW_X", closing and reopening whatever quotes it sits in, so
//     the shell reads the value as one word wherever it is written.
//   - A webhook's URL gets each value percent-encoded, and its JSON body each
//     value JSON-escaped (or, outside a string, a JSON string or number).
//   - Prompts, notifications and names get the text as it is.

var placeholder = regexp.MustCompile(`\{\{\s*([a-z0-9_.-]+)\s*\}\}`)

// expand is plain text substitution, for fields no program parses.
func expand(s string, vars map[string]string) string {
	return placeholder.ReplaceAllStringFunc(s, func(m string) string {
		return vars[placeholder.FindStringSubmatch(m)[1]]
	})
}

var nonEnv = regexp.MustCompile(`[^A-Z0-9_]+`)

// maxFlowEnvValue keeps one variable within what an exec'd environment
// entry may hold on Linux (128 KiB).
const maxFlowEnvValue = 100 << 10

// flowEnvNames gives each variable its environment name, BERTH_FLOW_ and its
// name in capitals, numbering any two that would clash.
func flowEnvNames(keys []string) map[string]string {
	sort.Strings(keys)
	out, taken := map[string]string{}, map[string]bool{}
	for _, k := range keys {
		if _, ok := out[k]; ok {
			continue
		}
		base := "BERTH_FLOW_" + strings.Trim(nonEnv.ReplaceAllString(strings.ToUpper(k), "_"), "_")
		name := base
		for i := 2; taken[name]; i++ {
			name = base + "_" + strconv.Itoa(i)
		}
		taken[name] = true
		out[k] = name
	}
	return out
}

// shellTemplate turns a run step's command into a script that refers to
// its variables, and the environment that holds them. The script contains
// no value at all.
func shellTemplate(command string, vars map[string]string) (string, []string) {
	keys := make([]string, 0, len(vars))
	for k := range vars {
		keys = append(keys, k)
	}
	// A variable the command names but nothing set is empty, as before.
	used := map[string]bool{}
	for _, m := range placeholder.FindAllStringSubmatch(command, -1) {
		if _, ok := vars[m[1]]; !ok && !used[m[1]] {
			keys = append(keys, m[1])
		}
		used[m[1]] = true
	}
	names := flowEnvNames(keys)
	env := make([]string, 0, len(names))
	for k, name := range names {
		v := strings.ReplaceAll(vars[k], "\x00", "")
		if len(v) > maxFlowEnvValue {
			v = v[len(v)-maxFlowEnvValue:]
		}
		env = append(env, name+"="+v)
	}
	sort.Strings(env)
	return renderShell(command, func(key string) string { return names[key] }), env
}

// Shell quoting contexts, as far as renderShell follows them.
const (
	shBare = iota
	shSingle
	shDouble
)

type shFrame struct {
	kind   int
	closer byte // for bare: ')' for $( … ), '`' for backticks, 0 at top
	depth  int  // open ( inside a $( … )
}

// renderShell replaces each {{x}} in command with a quoted reference to the
// environment variable name(x), fitted to the quotes around it. It follows
// single and double quotes, backslashes, $( … ) and backticks; anywhere it
// could misjudge (a here-document, $'…'), the reference may come out with
// visible quotes or split into words, but the value is still never read as
// code: only the variable's name is in the script.
func renderShell(command string, name func(string) string) string {
	matches := placeholder.FindAllStringSubmatchIndex(command, -1)
	var out strings.Builder
	stack := []shFrame{{kind: shBare}}
	top := func() *shFrame { return &stack[len(stack)-1] }
	pop := func() {
		if len(stack) > 1 {
			stack = stack[:len(stack)-1]
		}
	}
	next := 0 // the next match
	for i := 0; i < len(command); {
		// A placeholder whose first brace a backslash escaped stays text.
		for next < len(matches) && matches[next][0] < i {
			next++
		}
		if next < len(matches) && i == matches[next][0] {
			ref := `"$` + name(command[matches[next][2]:matches[next][3]]) + `"`
			switch top().kind {
			case shSingle:
				ref = `'` + ref + `'`
			case shDouble:
				ref = `"` + ref + `"`
			}
			out.WriteString(ref)
			i = matches[next][1]
			next++
			continue
		}
		c := command[i]
		f := top()
		switch f.kind {
		case shSingle:
			if c == '\'' {
				pop()
			}
		case shDouble:
			switch {
			case c == '\\' && i+1 < len(command):
				out.WriteByte(c)
				i++
				c = command[i]
			case c == '"':
				pop()
			case c == '$' && i+1 < len(command) && command[i+1] == '(':
				out.WriteByte(c)
				i++
				c = command[i]
				stack = append(stack, shFrame{kind: shBare, closer: ')'})
			case c == '`':
				stack = append(stack, shFrame{kind: shBare, closer: '`'})
			}
		default:
			switch {
			case c == '\\' && i+1 < len(command):
				out.WriteByte(c)
				i++
				c = command[i]
			case c == '\'':
				stack = append(stack, shFrame{kind: shSingle})
			case c == '"':
				stack = append(stack, shFrame{kind: shDouble})
			case c == '$' && i+1 < len(command) && command[i+1] == '(':
				out.WriteByte(c)
				i++
				c = command[i]
				stack = append(stack, shFrame{kind: shBare, closer: ')'})
			case c == '`':
				if f.closer == '`' {
					pop()
				} else {
					stack = append(stack, shFrame{kind: shBare, closer: '`'})
				}
			case c == '(' && f.closer == ')':
				f.depth++
			case c == ')' && f.closer == ')':
				if f.depth > 0 {
					f.depth--
				} else {
					pop()
				}
			}
		}
		out.WriteByte(c)
		i++
	}
	return out.String()
}

// expandURL substitutes percent-encoded values, so a value can't add a
// path, a query parameter, a fragment or a different host.
func expandURL(s string, vars map[string]string) string {
	return placeholder.ReplaceAllStringFunc(s, func(m string) string {
		return strings.ReplaceAll(url.QueryEscape(vars[placeholder.FindStringSubmatch(m)[1]]), "+", "%20")
	})
}

var jsonNumber = regexp.MustCompile(`^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$`)

// expandJSON substitutes values into a JSON body: escaped inside a string,
// and outside one as a number when the value is one, else as a string, so a
// value can never add fields or end the document.
func expandJSON(s string, vars map[string]string) string {
	matches := placeholder.FindAllStringSubmatchIndex(s, -1)
	var out strings.Builder
	inString := false
	next := 0
	for i := 0; i < len(s); {
		for next < len(matches) && matches[next][0] < i {
			next++
		}
		if next < len(matches) && i == matches[next][0] {
			v := vars[s[matches[next][2]:matches[next][3]]]
			q, _ := json.Marshal(v)
			switch {
			case inString:
				out.Write(q[1 : len(q)-1])
			case jsonNumber.MatchString(v):
				out.WriteString(v)
			default:
				out.Write(q)
			}
			i = matches[next][1]
			next++
			continue
		}
		c := s[i]
		if inString && c == '\\' && i+1 < len(s) {
			out.WriteByte(c)
			out.WriteByte(s[i+1])
			i += 2
			continue
		}
		if c == '"' {
			inString = !inString
		}
		out.WriteByte(c)
		i++
	}
	return out.String()
}

// redact hides secret values in text that leaves the box or is kept.
func redact(s string, secrets []string) string {
	for _, v := range secrets {
		if len(v) >= 4 {
			s = strings.ReplaceAll(s, v, "[secret]")
		}
	}
	return s
}
