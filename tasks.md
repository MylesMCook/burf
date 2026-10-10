# Native feedback delivery

Owner: Codex, mac-mini. Isolated main at baseline5b1cf27c; primary preserved.
User authorized Windows startup fix followed by Git It Out.
Implemented one-command split setup, private main-window bridge, React overlay,
Vite toggle, cache reuse/readiness and development icon grouping.
Native Mac/Windows feedback/MCP/isolation pass. Windows frontend14.5s cold
dependencies and4.7s fresh profile with retained cache; command26.4s/24.2s.
HMR215ms Mac/1.207s Windows.2121 icons preserved;35 kit cases per OS pass with
platform skips. check-local30s passes types/units/120 browser cases/Go/script checks.
Both production frontend/native outputs exclude feedback under explicit opt-in.
Owned apps/processes/task cleaned up; no live providers or installed native replacement.
Evidence: ../plugins/wails/skills/wails/assets/native-feedback/tests/verification.json.
Next: commit/push main, verify hosted CI, deliver clean UI via existing workflow
to Mini,work-hp,mc-pc,MacBook, preserving rollback. Source clone/branch cleanup last.
Other frontends/older OS deferred.
