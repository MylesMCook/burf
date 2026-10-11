package feedbackhttp

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

type object map[string]json.RawMessage
type rule func(json.RawMessage) error
type schema map[string]rule

func decode(data []byte, dst any) error {
	if !utf8.Valid(data) {
		return errors.New("invalid UTF-8")
	}
	// The standard decoder accepts duplicate keys, which makes validation and
	// interpretation disagree. Reject duplicates and bound nesting up front.
	scan := json.NewDecoder(bytes.NewReader(data))
	if err := scanValue(scan, 0); err != nil {
		return err
	}
	if _, err := scan.Token(); err != io.EOF {
		return errors.New("expected one JSON value")
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(dst); err != nil {
		return err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return errors.New("expected one JSON value")
	}
	return nil
}
func scanValue(d *json.Decoder, depth int) error {
	if depth > 64 {
		return errors.New("JSON nesting limit reached")
	}
	token, err := d.Token()
	if err != nil {
		return err
	}
	delimiter, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	switch delimiter {
	case '{':
		keys := map[string]bool{}
		for d.More() {
			key, err := d.Token()
			if err != nil {
				return err
			}
			s, ok := key.(string)
			if !ok || keys[s] {
				return errors.New("duplicate or invalid JSON key")
			}
			keys[s] = true
			if err := scanValue(d, depth+1); err != nil {
				return err
			}
		}
	case '[':
		for d.More() {
			if err := scanValue(d, depth+1); err != nil {
				return err
			}
		}
	default:
		return errors.New("unexpected JSON delimiter")
	}
	_, err = d.Token()
	return err
}

func validate(o object, fields schema, required ...string) error {
	if o == nil {
		return errors.New("expected an object")
	}
	for _, k := range required {
		if _, ok := o[k]; !ok {
			return fmt.Errorf("missing %s", k)
		}
	}
	for k, v := range o {
		f, ok := fields[k]
		if !ok {
			return fmt.Errorf("unexpected field %s", k)
		}
		if bytes.Equal(bytes.TrimSpace(v), []byte("null")) {
			return fmt.Errorf("null %s", k)
		}
		if err := f(v); err != nil {
			return fmt.Errorf("invalid %s", k)
		}
	}
	return nil
}
func stringValue(v json.RawMessage) error {
	var s string
	if err := json.Unmarshal(v, &s); err != nil {
		return err
	}
	if len(s) > 128<<10 {
		return errors.New("string too long")
	}
	return nil
}
func nonempty(v json.RawMessage) error {
	if err := stringValue(v); err != nil {
		return err
	}
	if strings.TrimSpace(textValue(v)) == "" {
		return errors.New("empty string")
	}
	return nil
}
func idValue(v json.RawMessage) error {
	if err := stringValue(v); err != nil {
		return err
	}
	if !validID(textValue(v)) {
		return errors.New("invalid id")
	}
	return nil
}
func validID(s string) bool {
	if len(s) < 1 || len(s) > 128 {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}
func number(v json.RawMessage) error {
	var n float64
	if err := json.Unmarshal(v, &n); err != nil {
		return err
	}
	if math.IsNaN(n) || math.IsInf(n, 0) {
		return errors.New("nonfinite number")
	}
	return nil
}
func positive(v json.RawMessage) error {
	if err := number(v); err != nil {
		return err
	}
	var n float64
	json.Unmarshal(v, &n)
	if n < 0 {
		return errors.New("negative")
	}
	return nil
}
func boolean(v json.RawMessage) error { var b bool; return json.Unmarshal(v, &b) }
func oneOf(values ...string) rule {
	return func(v json.RawMessage) error {
		if err := stringValue(v); err != nil {
			return err
		}
		s := textValue(v)
		for _, want := range values {
			if s == want {
				return nil
			}
		}
		return errors.New("unknown value")
	}
}
func date(v json.RawMessage) error {
	if err := stringValue(v); err != nil {
		return err
	}
	_, err := time.Parse(time.RFC3339Nano, textValue(v))
	return err
}
func nested(fields schema, required ...string) rule {
	return func(v json.RawMessage) error {
		var o object
		if err := decode(v, &o); err != nil {
			return err
		}
		return validate(o, fields, required...)
	}
}
func array(item rule, limit int) rule {
	return func(v json.RawMessage) error {
		var items []json.RawMessage
		if err := decode(v, &items); err != nil {
			return err
		}
		if items == nil || len(items) > limit {
			return errors.New("invalid array size")
		}
		for _, x := range items {
			if bytes.Equal(x, []byte("null")) {
				return errors.New("null item")
			}
			if err := item(x); err != nil {
				return err
			}
		}
		return nil
	}
}

var rectFields = schema{"x": number, "y": number, "width": positive, "height": positive}
var rect = nested(rectFields, "x", "y", "width", "height")
var role = oneOf("human", "agent")
var threadItem = nested(schema{"id": idValue, "role": role, "content": nonempty, "timestamp": positive}, "id", "role", "content", "timestamp")
var annotationFields = schema{
	"id": idValue, "sessionId": idValue, "x": number, "y": number, "timestamp": positive, "comment": stringValue, "element": nonempty, "elementPath": nonempty,
	"status": oneOf("pending", "acknowledged", "resolved", "dismissed"), "kind": oneOf("feedback", "placement", "rearrange"), "intent": oneOf("fix", "change", "question", "approve"), "severity": oneOf("blocking", "important", "suggestion"),
	"selectedText": stringValue, "nearbyText": stringValue, "cssClasses": stringValue, "nearbyElements": stringValue, "computedStyles": stringValue, "fullPath": stringValue, "accessibility": stringValue, "reactComponents": stringValue, "sourceFile": stringValue, "url": stringValue, "authorId": stringValue,
	"isMultiSelect": boolean, "isFixed": boolean, "boundingBox": rect, "elementBoundingBoxes": array(rect, 256), "drawingIndex": positive,
	"createdAt": date, "updatedAt": date, "resolvedAt": date, "resolvedBy": role, "thread": array(threadItem, maxThread),
	"attributes": func(v json.RawMessage) error {
		var attrs map[string]string
		if err := decode(v, &attrs); err != nil {
			return err
		}
		if attrs == nil || len(attrs) > 256 {
			return errors.New("invalid attributes")
		}
		for k, s := range attrs {
			if len(k) > 1024 || len(s) > 128<<10 {
				return errors.New("large attribute")
			}
		}
		return nil
	},
	"placement": nested(schema{"componentType": nonempty, "width": positive, "height": positive, "scrollY": number, "text": stringValue}, "componentType", "width", "height", "scrollY"),
	"rearrange": nested(schema{"selector": nonempty, "label": stringValue, "tagName": nonempty, "originalRect": rect, "currentRect": rect}, "selector", "label", "tagName", "originalRect", "currentRect"),
	"frame": nested(schema{"path": array(nested(schema{"index": func(v json.RawMessage) error {
		var n int
		if err := json.Unmarshal(v, &n); err != nil {
			return err
		}
		if n < 0 {
			return errors.New("negative")
		}
		return nil
	}, "id": stringValue, "url": stringValue}, "index", "url"), 32), "x": number, "y": number, "fixed": boolean, "boundingBox": rect}, "path", "x", "y", "fixed", "boundingBox"),
}
var sessionFields = schema{"id": idValue, "url": nonempty, "status": oneOf("active", "approved", "closed"), "createdAt": date, "updatedAt": date, "projectId": stringValue, "metadata": func(v json.RawMessage) error {
	var m map[string]json.RawMessage
	if err := decode(v, &m); err != nil {
		return err
	}
	if m == nil {
		return errors.New("expected object")
	}
	return nil
}}

func textValue(v json.RawMessage) string     { var s string; json.Unmarshal(v, &s); return s }
func numericValue(v json.RawMessage) float64 { var n float64; json.Unmarshal(v, &n); return n }
func raw(v any) json.RawMessage              { b, _ := json.Marshal(v); return b }
