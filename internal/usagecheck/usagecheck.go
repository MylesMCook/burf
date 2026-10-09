// Package usagecheck keeps the commands' help in step with their flags. It
// reads the Go source of a program's commands, finds every flag each one
// defines, and reports a flag its usage error or the program's help leaves
// out, and a flag the help offers that the command does not define.
//
// It is for tests: cmd/burf and cmd/burfd each check their own help.
package usagecheck

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Command is one command's flags, as found in the source.
type Command struct {
	// Name is the command's words, e.g. "add ssh" or "session send"; empty
	// when the source does not say (a listing with only --json, say).
	Name string
	// Flags are the flag names it defines, without dashes.
	Flags []string
	// Usages are its usage error texts.
	Usages []string
	// Pos is where it is defined.
	Pos string
}

// flagMethods maps a flag.FlagSet method to the index of its name argument.
var flagMethods = map[string]int{
	"String": 0, "Bool": 0, "Int": 0, "Int64": 0, "Uint": 0, "Uint64": 0, "Float64": 0, "Duration": 0, "Func": 0, "BoolFunc": 0,
	"StringVar": 1, "BoolVar": 1, "IntVar": 1, "Int64Var": 1, "UintVar": 1, "Uint64Var": 1, "Float64Var": 1, "DurationVar": 1, "Var": 1, "TextVar": 1,
}

// Commands reads the non-test Go files in dirs and returns each command
// that defines flags. A command is the switch case that defines them, or
// failing that, the function.
func Commands(dirs ...string) ([]Command, error) {
	fset := token.NewFileSet()
	var files []*ast.File
	for _, dir := range dirs {
		paths, err := filepath.Glob(filepath.Join(dir, "*.go"))
		if err != nil {
			return nil, err
		}
		for _, p := range paths {
			if strings.HasSuffix(p, "_test.go") {
				continue
			}
			f, err := parser.ParseFile(fset, p, nil, 0)
			if err != nil {
				return nil, err
			}
			files = append(files, f)
		}
	}
	consts := map[string]string{}
	for _, f := range files {
		for _, d := range f.Decls {
			g, ok := d.(*ast.GenDecl)
			if !ok || g.Tok != token.CONST {
				continue
			}
			for _, spec := range g.Specs {
				vs := spec.(*ast.ValueSpec)
				for i, n := range vs.Names {
					if i < len(vs.Values) {
						if v, ok := stringLit(vs.Values[i]); ok {
							consts[n.Name] = v
						}
					}
				}
			}
		}
	}
	var out []Command
	for _, f := range files {
		for _, d := range f.Decls {
			fn, ok := d.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				continue
			}
			// The flags each scope (a case clause, or the function) defines.
			scopes := map[ast.Node]*Command{}
			var order []ast.Node
			var stack []ast.Node
			ast.Inspect(fn, func(n ast.Node) bool {
				if n == nil {
					stack = stack[:len(stack)-1]
					return true
				}
				stack = append(stack, n)
				name, ok := flagName(n)
				if !ok {
					return true
				}
				var scope ast.Node = fn
				for i := len(stack) - 1; i >= 0; i-- {
					if cc, ok := stack[i].(*ast.CaseClause); ok {
						scope = cc
						break
					}
				}
				c := scopes[scope]
				if c == nil {
					c = &Command{Pos: fset.Position(n.Pos()).String()}
					scopes[scope] = c
					order = append(order, scope)
				}
				c.Flags = append(c.Flags, name)
				return true
			})
			for _, scope := range order {
				c := scopes[scope]
				c.Name, c.Usages = describe(scope, consts)
				out = append(out, *c)
			}
		}
	}
	return out, nil
}

// flagName reports the flag a call like fs.String("name", ...) defines.
func flagName(n ast.Node) (string, bool) {
	call, ok := n.(*ast.CallExpr)
	if !ok {
		return "", false
	}
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return "", false
	}
	recv, ok := sel.X.(*ast.Ident)
	i, method := flagMethods[sel.Sel.Name]
	if !ok || recv.Name != "fs" || !method || i >= len(call.Args) {
		return "", false
	}
	return stringLit(call.Args[i])
}

// describe finds a scope's command name and usage texts. The name comes
// from the flag set's name (flag.NewFlagSet("add ssh", …) or berth's
// flags("pair", …)), or else from the words that start its usage text.
func describe(scope ast.Node, consts map[string]string) (string, []string) {
	var name string
	var usages []string
	ast.Inspect(scope, func(n ast.Node) bool {
		switch n := n.(type) {
		case *ast.CallExpr:
			fun := ""
			switch f := n.Fun.(type) {
			case *ast.Ident:
				fun = f.Name
			case *ast.SelectorExpr:
				fun = f.Sel.Name
			}
			if len(n.Args) == 0 {
				return true
			}
			arg, ok := stringLit(n.Args[0])
			switch {
			case ok && (fun == "NewFlagSet" || fun == "flags") && arg != "" && name == "":
				name = arg
			case ok && fun == "usageErr":
				usages = append(usages, arg)
			}
		case *ast.AssignStmt:
			for i, lhs := range n.Lhs {
				if id, ok := lhs.(*ast.Ident); ok && id.Name == "usage" && i < len(n.Rhs) {
					if v, ok := stringLit(n.Rhs[i]); ok {
						usages = append(usages, v)
					}
				}
			}
		case *ast.BasicLit:
			if v, ok := stringLit(n); ok && strings.HasPrefix(v, "usage:") {
				usages = append(usages, v)
			}
		case *ast.Ident:
			if v, ok := consts[n.Name]; ok && strings.HasPrefix(v, "usage:") && (n.Obj == nil || n.Obj.Kind == ast.Con) {
				usages = append(usages, v)
			}
		}
		return true
	})
	if name == "" && len(usages) > 0 {
		name = leadingWords(usages[0])
	}
	return name, usages
}

// leadingWords is the command in a usage text: "usage: burf upgrade BOX"
// gives "upgrade", "session send NAME TEXT" gives "session send".
func leadingWords(usage string) string {
	words := strings.Fields(strings.TrimPrefix(usage, "usage:"))
	if len(words) > 0 && (words[0] == "berth" || words[0] == "berthd" || words[0] == "burf" || words[0] == "burfd") {
		words = words[1:]
	}
	var cmd []string
	for _, w := range words {
		if !commandWord.MatchString(w) {
			break
		}
		cmd = append(cmd, w)
	}
	return strings.Join(cmd, " ")
}

var commandWord = regexp.MustCompile(`^[a-z][a-z0-9|-]*$`)

func stringLit(e ast.Expr) (string, bool) {
	lit, ok := e.(*ast.BasicLit)
	if !ok || lit.Kind != token.STRING {
		return "", false
	}
	s, err := strconv.Unquote(lit.Value)
	return s, err == nil
}

// Entries splits help text into one entry per command line: a line that
// starts with the program's name, plus the more indented lines under it
// (the rest of a long command, and its description).
func Entries(bin, help string) []string {
	var entries []string
	indent := -1
	for _, line := range strings.Split(help, "\n") {
		trimmed := strings.TrimLeft(line, " ")
		depth := len(line) - len(trimmed)
		switch {
		case depth > 0 && strings.HasPrefix(trimmed, bin+" "):
			entries = append(entries, trimmed)
			indent = depth
		case indent >= 0 && depth > indent && trimmed != "":
			entries[len(entries)-1] += "\n" + trimmed
		default:
			indent = -1
		}
	}
	return entries
}

// mentions reports whether text offers --name.
func mentions(text, name string) bool {
	return regexp.MustCompile(`--` + regexp.QuoteMeta(name) + `([^a-z0-9-]|$)`).MatchString(text)
}

var offered = regexp.MustCompile(`--([a-z][a-z0-9-]*)`)

// Problems compares commands with bin's help. --json is left out: every
// listing takes it, which the help says once rather than on every line.
// skip names flags a command defines but its help need not show, as
// "session send --queue".
func Problems(bin, help string, cmds []Command, skip map[string]bool) []string {
	entries := Entries(bin, help)
	// entriesFor are the help entries for a command: its own, not those of
	// a longer command that starts with the same words.
	entriesFor := func(cmd string) []string {
		var out []string
		for _, e := range entries {
			rest := strings.TrimPrefix(e, bin+" ")
			if rest == cmd || strings.HasPrefix(rest, cmd+" ") || strings.HasPrefix(rest, cmd+"\n") {
				out = append(out, e)
			}
		}
		return out
	}
	var problems []string
	defined := map[string]map[string]bool{}
	for _, c := range cmds {
		var flags []string
		for _, f := range c.Flags {
			if f != "json" {
				flags = append(flags, f)
			}
		}
		if c.Name != "" {
			if defined[c.Name] == nil {
				defined[c.Name] = map[string]bool{"json": true}
			}
			for _, f := range c.Flags {
				defined[c.Name][f] = true
			}
		}
		if len(flags) == 0 {
			continue
		}
		if c.Name == "" {
			problems = append(problems, fmt.Sprintf("%s: flags %v belong to no command; give it a usage error naming the command", c.Pos, flags))
			continue
		}
		helpEntries := entriesFor(c.Name)
		if len(helpEntries) == 0 {
			problems = append(problems, fmt.Sprintf("%s: %s %s is missing from %s help", c.Pos, bin, c.Name, bin))
		}
		for _, f := range flags {
			if skip[c.Name+" --"+f] {
				continue
			}
			if len(c.Usages) > 0 && !anyMentions(c.Usages, f) {
				problems = append(problems, fmt.Sprintf("%s: %s defines --%s, but its usage error leaves it out: %q", c.Pos, c.Name, f, c.Usages[0]))
			}
			if len(helpEntries) > 0 && !anyMentions(helpEntries, f) {
				problems = append(problems, fmt.Sprintf("%s: %s defines --%s, but %s help leaves it out", c.Pos, c.Name, f, bin))
			}
		}
	}
	// The other way: a flag the help offers must exist. Only commands whose
	// flags were found can be checked; the longest name that fits wins.
	names := make([]string, 0, len(defined))
	for n := range defined {
		names = append(names, n)
	}
	sort.Slice(names, func(i, j int) bool { return len(names[i]) > len(names[j]) })
	for _, e := range entries {
		rest := strings.TrimPrefix(e, bin+" ")
		for _, n := range names {
			if rest != n && !strings.HasPrefix(rest, n+" ") && !strings.HasPrefix(rest, n+"\n") {
				continue
			}
			for _, m := range offered.FindAllStringSubmatch(e, -1) {
				if !defined[n][m[1]] {
					problems = append(problems, fmt.Sprintf("%s help offers --%s for %s %s, which defines no such flag", bin, m[1], bin, n))
				}
			}
			break
		}
	}
	return problems
}

func anyMentions(texts []string, flag string) bool {
	for _, t := range texts {
		if mentions(t, flag) {
			return true
		}
	}
	return false
}

// Dir is the directory of a package relative to the module root, found
// from a test's working directory (its package directory).
func Dir(rel string) string {
	wd, _ := os.Getwd()
	for d := wd; ; d = filepath.Dir(d) {
		if _, err := os.Stat(filepath.Join(d, "go.mod")); err == nil {
			return filepath.Join(d, rel)
		}
		if filepath.Dir(d) == d {
			return rel
		}
	}
}
