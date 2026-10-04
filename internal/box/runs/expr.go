package runs

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Conditions (if.cond, loop.until) are a tiny expression language over a
// run's variables, and nothing more: no calls, no assignment, no scripting.
//
//	cond    := and { "||" and }
//	and     := compare { "&&" compare }
//	compare := operand [ op operand ]      op: == != < <= > >= contains matches
//	operand := 'text' | "text" | number | variable name (steps.check.exit_code)
//
// A variable that is not set reads as "". An operand alone is true unless
// it is "", "0" or "false". < and friends compare numbers.

type token struct {
	kind string // str, ident, op, end
	text string
}

func lex(s string) ([]token, error) {
	var out []token
	for i := 0; i < len(s); {
		c := s[i]
		switch {
		case c == ' ' || c == '\t' || c == '\n':
			i++
		case c == '\'' || c == '"':
			j := strings.IndexByte(s[i+1:], c)
			if j < 0 {
				return nil, fmt.Errorf("unclosed quote in %q", s)
			}
			out = append(out, token{"str", s[i+1 : i+1+j]})
			i += j + 2
		case strings.HasPrefix(s[i:], "&&"), strings.HasPrefix(s[i:], "||"), strings.HasPrefix(s[i:], "=="),
			strings.HasPrefix(s[i:], "!="), strings.HasPrefix(s[i:], "<="), strings.HasPrefix(s[i:], ">="):
			out = append(out, token{"op", s[i : i+2]})
			i += 2
		case c == '<' || c == '>':
			out = append(out, token{"op", string(c)})
			i++
		default:
			j := i
			for j < len(s) && (isIdent(s[j])) {
				j++
			}
			if j == i {
				return nil, fmt.Errorf("unexpected %q in %q", string(c), s)
			}
			w := s[i:j]
			if w == "contains" || w == "matches" {
				out = append(out, token{"op", w})
			} else {
				out = append(out, token{"ident", w})
			}
			i = j
		}
	}
	return append(out, token{kind: "end"}), nil
}

func isIdent(c byte) bool {
	return c == '.' || c == '_' || c == '-' || c >= '0' && c <= '9' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
}

type parser struct {
	toks []token
	i    int
	vars map[string]string
}

func (p *parser) peek() token { return p.toks[p.i] }
func (p *parser) next() token  { t := p.toks[p.i]; p.i++; return t }

// Eval evaluates cond against vars.
func Eval(cond string, vars map[string]string) (bool, error) {
	if strings.TrimSpace(cond) == "" {
		return true, nil
	}
	toks, err := lex(cond)
	if err != nil {
		return false, err
	}
	p := &parser{toks: toks, vars: vars}
	v, err := p.or()
	if err != nil {
		return false, err
	}
	if p.peek().kind != "end" {
		return false, fmt.Errorf("unexpected %q in %q", p.peek().text, cond)
	}
	return v, nil
}

// CheckCond reports whether cond parses.
func CheckCond(cond string) error {
	_, err := Eval(cond, map[string]string{})
	return err
}

func (p *parser) or() (bool, error) {
	v, err := p.and()
	for err == nil && p.peek().kind == "op" && p.peek().text == "||" {
		p.next()
		var w bool
		w, err = p.and()
		v = v || w
	}
	return v, err
}

func (p *parser) and() (bool, error) {
	v, err := p.compare()
	for err == nil && p.peek().kind == "op" && p.peek().text == "&&" {
		p.next()
		var w bool
		w, err = p.compare()
		v = v && w
	}
	return v, err
}

func (p *parser) operand() (string, error) {
	t := p.next()
	switch t.kind {
	case "str":
		return t.text, nil
	case "ident":
		if _, err := strconv.ParseFloat(t.text, 64); err == nil {
			return t.text, nil
		}
		if t.text == "true" || t.text == "false" {
			return t.text, nil
		}
		return p.vars[t.text], nil
	}
	return "", fmt.Errorf("expected a value, got %q", t.text)
}

func (p *parser) compare() (bool, error) {
	a, err := p.operand()
	if err != nil {
		return false, err
	}
	t := p.peek()
	if t.kind != "op" || t.text == "&&" || t.text == "||" {
		return a != "" && a != "0" && a != "false", nil
	}
	p.next()
	b, err := p.operand()
	if err != nil {
		return false, err
	}
	switch t.text {
	case "==":
		return a == b, nil
	case "!=":
		return a != b, nil
	case "contains":
		return strings.Contains(a, b), nil
	case "matches":
		re, err := regexp.Compile(b)
		if err != nil {
			return false, err
		}
		return re.MatchString(a), nil
	}
	x, errA := strconv.ParseFloat(strings.TrimSpace(a), 64)
	y, errB := strconv.ParseFloat(strings.TrimSpace(b), 64)
	if errA != nil || errB != nil {
		return false, nil
	}
	switch t.text {
	case "<":
		return x < y, nil
	case "<=":
		return x <= y, nil
	case ">":
		return x > y, nil
	}
	return x >= y, nil
}
