---
name: release
description: Review Burf release readiness against fork signing, feed and platform gates. Use when explicitly asked to prepare a release.
---

# Burf Release Readiness

Read `FORK.md`, `UPSTREAM.md` and `docs/contributing/releasing.mdx` first.
Burf's updater key and endpoints are empty. Upstream signing credentials,
Homebrew cask, Linux release helpers and merged feeds do not release Burf.

Prepare local artifacts and record exact checks and platform gaps. Existing
fork scripts and workflow use `burf`/`burfd` plus legacy aliases; do not invent
published asset URLs or copy upstream signing identities. Never replace an
installed app, restart a daemon, upload, tag, push or publish without the
owner's direct authorization. Readiness is separate from native installation,
provider and upgrade acceptance. Leave publication to an explicit request.
