package localchat

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
)

const MaxPresentationBytes = 16 << 10
const maxPendingForms = 4

var presentationWait = 90 * time.Second
var presentationKey = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_-]{0,63}$`)

// Presentation is the bounded, data-only result of Burf's own present tool.
// ParsePresentation validates the discriminant and refuses fields from other variants.
type Presentation struct {
	ID       string               `json:"id,omitempty"`
	Type     string               `json:"type"`
	Label    string               `json:"label,omitempty"`
	Value    string               `json:"value,omitempty"`
	Points   []float64            `json:"points,omitempty"`
	Variant  string               `json:"variant,omitempty"`
	Delta    string               `json:"delta,omitempty"`
	Trend    string               `json:"trend,omitempty"`
	UpIsGood *bool                `json:"upIsGood,omitempty"`
	Columns  []PresentationColumn `json:"columns,omitempty"`
	Rows     []map[string]any     `json:"rows,omitempty"`
	Caption  string               `json:"caption,omitempty"`
	Server   string               `json:"server,omitempty"`
	Message  string               `json:"message,omitempty"`
	Fields   []PresentationField  `json:"fields,omitempty"`
	State    string               `json:"state,omitempty"`
}
type PresentationColumn struct {
	Key      string              `json:"key"`
	Label    string              `json:"label"`
	Sortable *bool               `json:"sortable,omitempty"`
	Priority string              `json:"priority,omitempty"`
	Align    string              `json:"align,omitempty"`
	Format   *PresentationFormat `json:"format,omitempty"`
}
type PresentationFormat struct {
	Kind string `json:"kind"`
}
type PresentationField struct {
	Name     string   `json:"name"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	Options  []string `json:"options,omitempty"`
	Required bool     `json:"required,omitempty"`
	Value    string   `json:"value"`
}
type PresentationAnswer struct {
	Action string            `json:"action"`
	Values map[string]string `json:"values,omitempty"`
}
type pendingPresentation struct {
	turn   string
	result chan Presentation
}

// ParsePresentation accepts only tool inputs, never client-assigned IDs or state.
func ParsePresentation(raw []byte) (Presentation, error) {
	var p Presentation
	if len(raw) == 0 || len(raw) > MaxPresentationBytes {
		return p, errors.New("presentation must fit 16 KiB")
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil || fields == nil {
		return p, errors.New("presentation must be an object")
	}
	if err := json.Unmarshal(fields["type"], &p.Type); err != nil {
		return p, errors.New("name the presentation type")
	}
	allowed := []string{"type"}
	switch p.Type {
	case "chart":
		allowed = append(allowed, "label", "value", "points", "variant", "delta", "trend", "upIsGood")
	case "table":
		allowed = append(allowed, "columns", "rows", "caption")
	case "form":
		allowed = append(allowed, "message", "fields")
	default:
		return p, errors.New("presentation type must be chart, table or form")
	}
	for key := range fields {
		if !slices.Contains(allowed, key) {
			return p, fmt.Errorf("unknown presentation field %q", key)
		}
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(&p); err != nil {
		return p, err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return p, errors.New("one presentation is required")
	}
	if err := p.validate(); err != nil {
		return Presentation{}, err
	}
	return p, nil
}
func visible(text string, required bool) bool {
	return len(text) <= 4096 && (!required || strings.TrimSpace(text) != "") && !strings.ContainsFunc(text, func(r rune) bool {
		return r != '\n' && r != '\t' && (unicode.IsControl(r) || unicode.In(r, unicode.Cf))
	})
}
func (p Presentation) validate() error {
	switch p.Type {
	case "chart":
		if !visible(p.Label, true) || !visible(p.Value, true) || !visible(p.Delta, false) || len(p.Points) == 0 || len(p.Points) > 256 || !slices.Contains([]string{"", "area", "line", "bars"}, p.Variant) || !slices.Contains([]string{"", "up", "down", "flat"}, p.Trend) {
			return errors.New("chart needs a label, value and 1 to 256 finite points")
		}
		for _, n := range p.Points {
			if math.IsNaN(n) || math.IsInf(n, 0) {
				return errors.New("chart points must be finite")
			}
		}
	case "table":
		if len(p.Columns) == 0 || len(p.Columns) > 16 || len(p.Rows) == 0 || len(p.Rows) > 100 || !visible(p.Caption, false) {
			return errors.New("table needs 1 to 16 columns and 1 to 100 rows")
		}
		keys := map[string]bool{}
		for _, c := range p.Columns {
			if !presentationKey.MatchString(c.Key) || keys[c.Key] || !visible(c.Label, true) || !slices.Contains([]string{"", "primary", "secondary"}, c.Priority) || !slices.Contains([]string{"", "start", "end"}, c.Align) || (c.Format != nil && !slices.Contains([]string{"text", "number", "boolean"}, c.Format.Kind)) {
				return errors.New("table columns need unique simple keys, labels and supported formats")
			}
			keys[c.Key] = true
		}
		for _, row := range p.Rows {
			if row == nil {
				return errors.New("table rows must be objects")
			}
			for key, value := range row {
				if !keys[key] {
					return errors.New("table row has an unknown column")
				}
				switch v := value.(type) {
				case nil, bool:
				case string:
					if !visible(v, false) {
						return errors.New("table text is invalid")
					}
				case float64:
					if math.IsNaN(v) || math.IsInf(v, 0) {
						return errors.New("table numbers must be finite")
					}
				default:
					return errors.New("table values must be text, finite numbers, booleans or null")
				}
			}
		}
	case "form":
		if !visible(p.Message, true) || len(p.Fields) == 0 || len(p.Fields) > 12 {
			return errors.New("form needs a message and 1 to 12 fields")
		}
		names := map[string]bool{}
		for _, f := range p.Fields {
			if !presentationKey.MatchString(f.Name) || names[f.Name] || !visible(f.Label, true) || !visible(f.Value, false) {
				return errors.New("form fields need unique simple names and labels")
			}
			names[f.Name] = true
			switch f.Kind {
			case "text":
				if len(f.Options) != 0 {
					return errors.New("text fields have no options")
				}
			case "toggle":
				if len(f.Options) != 0 || (f.Value != "" && f.Value != "true" && f.Value != "false") {
					return errors.New("toggle values are true or false")
				}
			case "choice":
				if len(f.Options) == 0 || len(f.Options) > 20 {
					return errors.New("choice fields need 1 to 20 options")
				}
				seen := map[string]bool{}
				for _, option := range f.Options {
					if !visible(option, true) || seen[option] {
						return errors.New("choices need unique visible labels")
					}
					seen[option] = true
				}
				if f.Value != "" && !seen[f.Value] {
					return errors.New("choice value must be an offered option")
				}
			default:
				return errors.New("form field kind must be text, choice or toggle")
			}
		}
	default:
		return errors.New("unknown presentation type")
	}
	return nil
}
func (p Presentation) clone() Presentation {
	raw, _ := json.Marshal(p)
	var copy Presentation
	_ = json.Unmarshal(raw, &copy)
	return copy
}
func (p Presentation) Text() string {
	switch p.Type {
	case "chart":
		return p.Label + ": " + p.Value + "\n" + fmt.Sprint(p.Points)
	case "table":
		raw, _ := json.Marshal(struct {
			Columns []PresentationColumn `json:"columns"`
			Rows    []map[string]any     `json:"rows"`
		}{p.Columns, p.Rows})
		return p.Caption + "\n" + string(raw)
	case "form":
		raw, _ := json.Marshal(p.Fields)
		return p.Message + "\nForm " + p.State + "\n" + string(raw)
	}
	return ""
}

// Present publishes an owned tool's data during this turn. Only a form waits.
func (m *Manager) Present(ctx context.Context, id string, p Presentation) (Presentation, error) {
	r, err := m.get(id)
	if err != nil {
		return Presentation{}, err
	}
	// Reparse so even internal callers cannot forge resolved state or oversized data.
	raw, err := json.Marshal(p)
	if err != nil {
		return Presentation{}, err
	}
	p, err = ParsePresentation(raw)
	if err != nil {
		return Presentation{}, err
	}
	var token [16]byte
	if _, err = rand.Read(token[:]); err != nil {
		return Presentation{}, err
	}
	p.ID = "present-" + hex.EncodeToString(token[:])
	if p.Type == "form" {
		p.State, p.Server = "request", "Burf"
		for i := range p.Fields {
			if p.Fields[i].Kind == "toggle" && p.Fields[i].Value == "" {
				p.Fields[i].Value = "false"
			}
		}
	}
	encoded, _ := json.Marshal(p)
	if len(encoded) > MaxPresentationBytes {
		return Presentation{}, errors.New("presentation including its identity must fit 16 KiB")
	}
	r.mu.Lock()
	if !r.tools || (r.session.State != "running" && r.session.State != "waiting") || r.session.TurnID == "" {
		r.mu.Unlock()
		return Presentation{}, errors.New("presentations require Burf tools during an active turn")
	}
	var ch chan Presentation
	if p.Type == "form" {
		if len(r.forms) >= maxPendingForms {
			r.mu.Unlock()
			return Presentation{}, errors.New("too many forms are waiting")
		}
		ch = make(chan Presentation, 1)
		if r.forms == nil {
			r.forms = map[string]pendingPresentation{}
		}
		r.forms[p.ID] = pendingPresentation{turn: r.session.TurnID, result: ch}
		r.session.State = "waiting"
	}
	status := "completed"
	if p.Type == "form" {
		status = "inProgress"
	}
	r.put(Item{ID: p.ID, Kind: "tool", Text: "burf_present\n" + p.Text(), Status: status, Presentation: &p})
	r.mu.Unlock()
	if ch == nil {
		return p.clone(), nil
	}
	timer := time.NewTimer(presentationWait)
	defer timer.Stop()
	select {
	case result := <-ch:
		return result, nil
	case <-ctx.Done():
	case <-timer.C:
	}
	r.mu.Lock()
	r.settleForm(p.ID, "cancelled", nil)
	r.mu.Unlock()
	return <-ch, nil
}

// AnswerPresentation consumes exactly one pending form, never a permission token.
func (m *Manager) AnswerPresentation(id, presentation string, answer PresentationAnswer) error {
	r, err := m.get(id)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	pending, ok := r.forms[presentation]
	if !ok || pending.turn != r.session.TurnID || (r.session.State != "running" && r.session.State != "waiting") {
		return errors.New("form is no longer pending")
	}
	var p *Presentation
	for _, item := range r.session.Items {
		if item.ID == presentation {
			p = item.Presentation
			break
		}
	}
	if p == nil {
		return errors.New("form is no longer available")
	}
	if answer.Action == "decline" {
		if len(answer.Values) != 0 {
			return errors.New("a declined form carries no values")
		}
		r.settleForm(presentation, "declined", nil)
		return nil
	}
	if answer.Action != "accept" {
		return errors.New("form action must be accept or decline")
	}
	fields := map[string]PresentationField{}
	for _, field := range p.Fields {
		fields[field.Name] = field
	}
	raw, _ := json.Marshal(answer.Values)
	if len(raw) > MaxPresentationBytes {
		return errors.New("form answer must fit 16 KiB")
	}
	for name, value := range answer.Values {
		f, exists := fields[name]
		if !exists || !visible(value, false) {
			return errors.New("form answer has an unknown or invalid field")
		}
		if f.Kind == "choice" && value != "" && !slices.Contains(f.Options, value) {
			return errors.New("form answer is not an offered choice")
		}
		if f.Kind == "toggle" && value != "true" && value != "false" {
			return errors.New("toggle answer must be true or false")
		}
	}
	for _, field := range p.Fields {
		if field.Required {
			value, present := answer.Values[field.Name]
			if !present || strings.TrimSpace(value) == "" {
				return fmt.Errorf("field %s is required", field.Name)
			}
		}
	}
	updated := p.clone()
	for i := range updated.Fields {
		if value, ok := answer.Values[updated.Fields[i].Name]; ok {
			updated.Fields[i].Value = value
		}
	}
	updatedRaw, _ := json.Marshal(updated)
	if len(updatedRaw) > MaxPresentationBytes {
		return errors.New("completed form must fit 16 KiB")
	}
	r.settleForm(presentation, "accepted", answer.Values)
	r.trim()
	return nil
}

// Caller holds mu. Removal precedes delivery, including timeout and turn cleanup.
func (r *running) settleForm(id, state string, values map[string]string) {
	pending, ok := r.forms[id]
	if !ok {
		return
	}
	delete(r.forms, id)
	for i, item := range r.session.Items {
		if item.ID == id && item.Presentation != nil {
			p := item.Presentation.clone()
			p.State = state
			for j := range p.Fields {
				if value, ok := values[p.Fields[j].Name]; ok {
					p.Fields[j].Value = value
				}
			}
			item.Presentation = &p
			item.Status = "completed"
			item.Text = "burf_present\n" + p.Text()
			r.session.Items[i] = item
			pending.result <- p.clone()
			break
		}
	}
	if r.session.State == "waiting" && len(r.forms)+len(r.approvals)+len(r.toolAsks) == 0 {
		r.session.State = "running"
	}
}
func (r *running) cancelForms() {
	for id := range r.forms {
		r.settleForm(id, "cancelled", nil)
	}
}
func itemBytes(item Item) int {
	size := len(item.Text)
	if item.Presentation != nil {
		raw, _ := json.Marshal(item.Presentation)
		size += len(raw)
	}
	return size
}
