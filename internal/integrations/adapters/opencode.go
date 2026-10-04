package adapters

// OpenCode reports through a small plugin berth installs, which runs the
// hook for the bus events below with {"cwd", "session_id"}.
var OpenCode = register(&Adapter{
	Name: "opencode",
	Caps: Caps{Ready: false, Started: true, Waiting: true, Finished: true, Via: "plugin"},
	Translate: func(hook string, in Payload) (string, map[string]any, bool) {
		d := map[string]any{"path": in.Str("cwd"), "agent_session_id": in.Str("session_id")}
		switch hook {
		case "session.busy":
			d["signal"] = "prompt"
			return Started, d, true
		case "permission.updated", "permission.asked":
			d["reason"] = "permission"
			return Waiting, d, true
		case "permission.replied":
			d["signal"] = "tool"
			return Started, d, true
		case "session.idle":
			return Finished, d, true
		}
		return "", nil, false
	},
})

// OpenCodePlugin is the plugin file, for the berth binary at bin.
func OpenCodePlugin(bin string) string {
	return `// Installed by berth: tells berth when an OpenCode turn starts, needs you, or ends.
// Only the session ID and the working directory leave OpenCode.
export const BerthPlugin = async ({ $, directory }) => {
  const report = async (event, sessionID) => {
    const payload = JSON.stringify({ cwd: directory, session_id: sessionID || "" });
    try { await $` + "`${" + jsString(bin) + "} hook opencode ${event} ${payload}`" + `.quiet().nothrow(); } catch {}
  };
  return {
    event: async ({ event }) => {
      const p = event.properties || {};
      if (event.type === "session.status" && p.status && p.status.type === "busy") await report("session.busy", p.sessionID);
      else if (event.type === "session.idle") await report("session.idle", p.sessionID);
      else if (event.type === "permission.updated" || event.type === "permission.asked") await report("permission.updated", p.sessionID);
      else if (event.type === "permission.replied") await report("permission.replied", p.sessionID);
    },
  };
};
`
}

func jsString(s string) string {
	out := []byte{'"'}
	for _, r := range s {
		switch r {
		case '"', '\\':
			out = append(out, '\\', byte(r))
		default:
			out = append(out, string(r)...)
		}
	}
	return string(append(out, '"'))
}
