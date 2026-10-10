// Package acp is a thin speaker of the Agent Client Protocol schema over
// newline-delimited JSON-RPC 2.0. Burf's localchat manager owns the process
// and pipes; this package only shapes the lines.
package acp

import "encoding/json"

const (
	JSONRPC         = "2.0"
	ProtocolVersion = 1
)

// ClientInfo identifies Burf during initialize.
func ClientInfo() map[string]any {
	return map[string]any{"name": "burf", "title": "Burf", "version": "1"}
}

// ClientCapabilities is the baseline Burf offers. File and terminal methods
// are not implemented here, so they stay off.
func ClientCapabilities() map[string]any {
	return map[string]any{
		"fs":       map[string]any{"readTextFile": false, "writeTextFile": false},
		"terminal": false,
	}
}

func Request(id any, method string, params any) map[string]any {
	msg := map[string]any{"jsonrpc": JSONRPC, "id": id, "method": method}
	if params != nil {
		msg["params"] = params
	}
	return msg
}

func Notification(method string, params any) map[string]any {
	msg := map[string]any{"jsonrpc": JSONRPC, "method": method}
	if params != nil {
		msg["params"] = params
	}
	return msg
}

func Result(id json.RawMessage, result any) map[string]any {
	return map[string]any{"jsonrpc": JSONRPC, "id": id, "result": result}
}

func Error(id json.RawMessage, code int, message string) map[string]any {
	return map[string]any{"jsonrpc": JSONRPC, "id": id, "error": map[string]any{"code": code, "message": message}}
}

// TextPrompt is a single text block for session/prompt.
func TextPrompt(text string) []map[string]any {
	return []map[string]any{{"type": "text", "text": text}}
}

// PermissionSelected answers session/request_permission.
func PermissionSelected(optionID string) map[string]any {
	return map[string]any{"outcome": map[string]any{"outcome": "selected", "optionId": optionID}}
}

// PermissionCancelled answers a permission request after session/cancel.
func PermissionCancelled() map[string]any {
	return map[string]any{"outcome": map[string]any{"outcome": "cancelled"}}
}
