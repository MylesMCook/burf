package box

import (
	"fmt"
	"strconv"
	"strings"
)

// Snapshots: the page's accessibility tree, compact, with a ref (@eN) on
// every element an agent can act on. A ref stays the same element across
// snapshots of a page, so a delta after an action shows only what changed.

type axValue struct {
	Value any `json:"value"`
}

func (v *axValue) str() string {
	if v == nil || v.Value == nil {
		return ""
	}
	switch t := v.Value.(type) {
	case string:
		return t
	case bool:
		return strconv.FormatBool(t)
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	}
	return fmt.Sprint(v.Value)
}

type axNode struct {
	NodeID     string   `json:"nodeId"`
	Ignored    bool     `json:"ignored"`
	Role       *axValue `json:"role"`
	Name       *axValue `json:"name"`
	Value      *axValue `json:"value"`
	Properties []struct {
		Name  string  `json:"name"`
		Value axValue `json:"value"`
	} `json:"properties"`
	ChildIDs         []string `json:"childIds"`
	ParentID         string   `json:"parentId"`
	BackendDOMNodeID int64    `json:"backendDOMNodeId"`
}

var interactiveRoles = map[string]bool{
	"button": true, "link": true, "textbox": true, "searchbox": true, "checkbox": true, "radio": true, "combobox": true,
	"listbox": true, "option": true, "menuitem": true, "menuitemcheckbox": true, "menuitemradio": true, "tab": true,
	"switch": true, "slider": true, "spinbutton": true, "treeitem": true,
}

// contextRoles show in an interactive snapshot too: they say where things are.
var contextRoles = map[string]bool{"heading": true, "alert": true, "status": true, "dialog": true, "alertdialog": true}

var noiseRoles = map[string]bool{"generic": true, "none": true, "presentation": true, "InlineTextBox": true, "LineBreak": true, "RootWebArea": true, "WebArea": true, "ignored": true}

type snapOptions struct {
	full     bool
	depth    int   // 0: no limit
	root     int64 // backend node to start from; 0: the page
	maxLines int
}

// renderAX renders nodes, giving refs from refs (backend node → ref),
// assigning new ones with next. It returns the lines.
func renderAX(nodes []axNode, refs map[int64]string, next *int, o snapOptions) []string {
	byID := make(map[string]*axNode, len(nodes))
	var root *axNode
	for i := range nodes {
		n := &nodes[i]
		byID[n.NodeID] = n
		if root == nil && n.ParentID == "" {
			root = n
		}
		if o.root != 0 && n.BackendDOMNodeID == o.root {
			root = n
		}
	}
	if root == nil {
		return nil
	}
	var lines []string
	var walk func(n *axNode, depth int, parentName string)
	walk = func(n *axNode, depth int, parentName string) {
		if o.maxLines > 0 && len(lines) >= o.maxLines {
			return
		}
		role := n.Role.str()
		name := strings.Join(strings.Fields(n.Name.str()), " ")
		show := false
		if !n.Ignored {
			switch {
			case interactiveRoles[role], contextRoles[role]:
				show = true
			case o.full && !noiseRoles[role] && (name != "" || role != "StaticText"):
				// A label's own text repeats its name: once is enough.
				show = role != "StaticText" || (name != "" && name != parentName)
			}
		}
		next2 := depth
		childParent := parentName
		if show {
			if o.depth == 0 || depth < o.depth {
				lines = append(lines, strings.Repeat("  ", depth)+axLine(n, role, name, refs, next))
			}
			next2 = depth + 1
			childParent = name
		}
		for _, c := range n.ChildIDs {
			if child := byID[c]; child != nil {
				walk(child, next2, childParent)
			}
		}
	}
	walk(root, 0, "")
	return lines
}

func clip(s string, n int) string {
	if len(s) > n {
		return s[:n] + "…"
	}
	return s
}

func axLine(n *axNode, role, name string, refs map[int64]string, next *int) string {
	var b strings.Builder
	b.WriteString("- ")
	if role == "StaticText" {
		b.WriteString("text")
	} else {
		b.WriteString(role)
	}
	if name != "" {
		fmt.Fprintf(&b, " %q", clip(name, 80))
	}
	for _, p := range n.Properties {
		switch p.Name {
		case "level":
			if role == "heading" {
				fmt.Fprintf(&b, " [level=%s]", p.Value.str())
			}
		case "checked", "pressed", "selected":
			if v := p.Value.str(); v == "true" || v == "mixed" {
				fmt.Fprintf(&b, " [%s]", p.Name)
			}
		case "disabled":
			if p.Value.str() == "true" {
				b.WriteString(" [disabled]")
			}
		case "expanded":
			fmt.Fprintf(&b, " [expanded=%s]", p.Value.str())
		case "required":
			if p.Value.str() == "true" {
				b.WriteString(" [required]")
			}
		}
	}
	if v := n.Value.str(); v != "" && (role == "textbox" || role == "searchbox" || role == "combobox" || role == "spinbutton" || role == "slider") {
		fmt.Fprintf(&b, " value=%q", clip(v, 40))
	}
	if interactiveRoles[role] && n.BackendDOMNodeID != 0 {
		ref, ok := refs[n.BackendDOMNodeID]
		if !ok {
			*next++
			ref = "e" + strconv.Itoa(*next)
			refs[n.BackendDOMNodeID] = ref
		}
		b.WriteString(" [@" + ref + "]")
	}
	return b.String()
}

// diffLines is what changed from old to new, as "+ line" and "- line", in
// order, by a longest common subsequence.
func diffLines(old, cur []string) []string {
	n, m := len(old), len(cur)
	if n*m > 400000 {
		// Too big to diff cheaply: everything is new.
		out := make([]string, 0, m)
		for _, l := range cur {
			out = append(out, "+ "+l)
		}
		return out
	}
	lcs := make([][]int32, n+1)
	for i := range lcs {
		lcs[i] = make([]int32, m+1)
	}
	for i := n - 1; i >= 0; i-- {
		for j := m - 1; j >= 0; j-- {
			if old[i] == cur[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else {
				lcs[i][j] = max(lcs[i+1][j], lcs[i][j+1])
			}
		}
	}
	bare := func(l string) string { return strings.TrimPrefix(strings.TrimLeft(l, " "), "- ") }
	var out []string
	i, j := 0, 0
	for i < n && j < m {
		switch {
		case old[i] == cur[j]:
			i++
			j++
		case lcs[i+1][j] >= lcs[i][j+1]:
			out = append(out, "- "+bare(old[i]))
			i++
		default:
			out = append(out, "+ "+bare(cur[j]))
			j++
		}
	}
	for ; i < n; i++ {
		out = append(out, "- "+bare(old[i]))
	}
	for ; j < m; j++ {
		out = append(out, "+ "+bare(cur[j]))
	}
	return out
}
