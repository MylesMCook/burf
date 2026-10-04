package adapters

// Cursor is Cursor Agent, through ~/.cursor/hooks.json. It has no hook for
// "needs you", so the screen adapter watches for approval prompts.
var Cursor = register(&Adapter{
	Name: "cursor",
	Caps: Caps{Ready: true, Started: true, Waiting: false, Finished: true, FinalMessage: true, Via: "hooks"},
	Translate: func(hook string, in Payload) (string, map[string]any, bool) {
		d := map[string]any{"conversation_id": in.Str("conversation_id"), "agent_session_id": in.Str("conversation_id")}
		if roots, ok := in["workspace_roots"].([]any); ok && len(roots) > 0 {
			d["path"], _ = roots[0].(string)
		}
		switch hook {
		case "sessionStart":
			return Ready, d, true
		case "beforeSubmitPrompt":
			d["signal"] = "prompt"
			return Started, d, true
		case "stop":
			d["status"] = in.Str("status")
			return Finished, d, true
		}
		return "", nil, false
	},
})
