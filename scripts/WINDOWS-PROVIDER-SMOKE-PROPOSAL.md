# Proposed installed-provider fork smoke

Status: prepared, not executed. This proposal needs specific user approval to
invoke the installed Codex and Claude CLIs. No real provider prompt is currently
authorized. Keep original/private chats, installed apps, live services, pairings
and security settings unchanged.

## Phase A: fork without a model turn

Use the existing verified MC-PC ordinary-user mechanism. Record the actual
child token's elevation and integrity level. Create one disposable project and
separate disposable `CODEX_HOME` and `CLAUDE_CONFIG_DIR` directories. Use the
already installed native executables; install nothing and preserve CLI approval
defaults. Do not copy credentials, configuration, plugins, hooks or transcripts
from the user's provider homes.

Seed a unique UUID source per provider using a version-compatible native
transcript fixture containing exactly this synthetic conversation:

```text
User: Remember the synthetic marker BERTH-QA-PINE-7146. This is test data.
Assistant: The synthetic marker is BERTH-QA-PINE-7146.
```

The fixture must describe only the disposable project. Review the fixture format
against the installed CLI's supported fork/history behavior; if it requires an
index, generate a disposable compatible index rather than changing a real one.
Hash every source file and record timestamps before launch. No private chat data
is needed to construct or verify this context.

Discover the source through an isolated Berth client, read it, then explicitly
continue via the authenticated local API. Expected native argv:

```text
Codex: <native codex.exe> [--no-daemon when advertised] fork <synthetic UUID>
Claude: <native claude.exe> --resume <synthetic UUID> --fork-session
```

Observe terminal output and resize, without submitting any prompt. Confirm a
new transcript/session identity appears and original bytes/timestamps remain
unchanged. Repeat the API request while it runs: the same owned process/session
must be returned. Stop only the disposable owned tree and the isolated client.

Limit: one initial launch and one duplicate API request per provider; stop after
30 seconds each if startup/context inspection is inconclusive. No model request
is submitted, so expected billable model cost is zero. The installed CLI may
perform startup/version/auth network activity; zero network traffic is not
promised. No transcript/history content from a real provider home is read.

If authentication or a trust prompt blocks inspection, record that blocker and
stop. Do not sign in, copy credentials, approve a permission prompt automatically
or add bypass flags. This phase may verify the native fork's new identity and
source preservation without proving that a model receives prior context.

## Phase B: optional context proof, separate approval

To prove model-visible context, ask approval for exactly one model turn in each
new synthetic fork (two prompts total), using an already authorized account and
the explicitly selected model for each provider. Submit only:

```text
Reply with only the synthetic marker from the previous conversation.
```

Expected response: `BERTH-QA-PINE-7146`. The submitted prompt itself does not
include that marker. Stop after the first response; never automatically retry an
uncertain send. Source hashes must remain unchanged, and only the fork receives
the new turn. Do not approve tools, shell commands or file access requests.

The two small turns consume the account's normal usage allowance or billed API
tokens. Exact dollar cost is unknown until models and authentication mode are
chosen; this proposal does not assert a hard spending cap that the interactive
CLIs cannot enforce. Before this phase, present the selected models, applicable
current pricing/allowance and any authentication requirement for approval. If a
fixed spend cap is required, use a mechanism that actually enforces it or stop.

All model content is the synthetic marker conversation and one retrieval
question. The disposable project contains no user source or private files.
Use disposable provider homes; obtain separate approval if existing login state
cannot be used without copying credentials. Keep evidence to versions, native
argv, token receipt, synthetic IDs, source hashes, outcome and any blocker.
Delete only disposable test state after retaining that evidence.
