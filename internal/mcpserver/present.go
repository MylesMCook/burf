package mcpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/MylesMCook/burf/internal/localchat"
)

type presentationResult struct{ localchat.Presentation }

func present(ctx context.Context, s *Server, args map[string]any) (any, error) {
	raw, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}
	p, err := localchat.ParsePresentation(raw)
	if err != nil {
		return nil, err
	}
	var result localchat.Presentation
	if err = s.Box.Call(ctx, http.MethodPost, "/v1/chats/"+url.PathEscape(s.Chat)+"/tools/present", p, &result); err != nil {
		return nil, err
	}
	return presentationResult{result}, nil
}

func presentationSchema() map[string]any {
	text := map[string]any{"type": "string", "maxLength": 4096}
	enum := func(values ...string) map[string]any { return map[string]any{"type": "string", "enum": values} }
	object := func(properties map[string]any, required ...string) map[string]any {
		return map[string]any{"type": "object", "properties": properties, "required": required, "additionalProperties": false}
	}
	array := func(items any, max int) map[string]any {
		return map[string]any{"type": "array", "items": items, "minItems": 1, "maxItems": max}
	}
	column := object(map[string]any{"key": text, "label": text, "sortable": map[string]any{"type": "boolean"}, "priority": enum("primary", "secondary"), "align": enum("start", "end"), "format": object(map[string]any{"kind": enum("text", "number", "boolean")}, "kind")}, "key", "label")
	field := object(map[string]any{"name": text, "label": text, "kind": enum("text", "choice", "toggle"), "options": array(text, 20), "required": map[string]any{"type": "boolean"}, "value": text}, "name", "label", "kind")
	return map[string]any{"type": "object", "oneOf": []any{
		object(map[string]any{"type": enum("chart"), "label": text, "value": text, "points": array(map[string]any{"type": "number"}, 256), "variant": enum("area", "line", "bars"), "delta": text, "trend": enum("up", "down", "flat"), "upIsGood": map[string]any{"type": "boolean"}}, "type", "label", "value", "points"),
		object(map[string]any{"type": enum("table"), "columns": array(column, 16), "rows": array(map[string]any{"type": "object", "additionalProperties": map[string]any{"type": []string{"string", "number", "boolean", "null"}}}, 100), "caption": text}, "type", "columns", "rows"),
		object(map[string]any{"type": enum("form"), "message": text, "fields": array(field, 12)}, "type", "message", "fields"),
	}}
}
