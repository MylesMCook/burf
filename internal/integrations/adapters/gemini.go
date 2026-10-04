package adapters

// Gemini is Gemini CLI, through the hooks in ~/.gemini/settings.json.
var Gemini = register(&Adapter{
	Name: "gemini",
	Caps: Caps{Ready: true, Started: true, Waiting: true, Finished: true, Via: "hooks"},
	Translate: func(hook string, in Payload) (string, map[string]any, bool) {
		d := map[string]any{"path": in.Str("cwd"), "agent_session_id": in.Str("session_id")}
		switch hook {
		case "SessionStart":
			return Ready, d, true
		case "BeforeAgent":
			d["signal"] = "prompt"
			return Started, d, true
		case "Notification":
			// Gemini notifies for tool permissions.
			if t := lower(in.Str("notification_type")); t != "" && t != "toolpermission" && t != "tool_permission" {
				return "", nil, false
			}
			d["reason"] = "permission"
			return Waiting, d, true
		case "AfterAgent":
			return Finished, d, true
		case "SessionEnd":
			return Exited, d, true
		}
		return "", nil, false
	},
})
