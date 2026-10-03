# Cal.com development kit

This kit now lives in its own repository:
**[sean-brydon/berth-kit-calcom](https://github.com/sean-brydon/berth-kit-calcom)**.

```sh
berth kit add github.com/sean-brydon/berth-kit-calcom
berth kit apply cal-com BOX/PROJECT
```

Every Cal.com worktree gets its own Postgres database (a copy of the main one
when migrations match), its own `.env`, URL and ports, a dev server, and
Prisma Studio on demand; removing the worktree drops its database. The
repository's README covers requirements, settings and troubleshooting, and
is a complete example of a kit kept in a git repository of its own.

Projects that have the kit from this folder keep working; `berth kit add` the
link above (same id, `cal-com`) and apply it again to move them to it.
