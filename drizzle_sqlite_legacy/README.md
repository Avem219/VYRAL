# Legacy SQLite migrations

This folder preserves the SQLite-dialect migration chain that was used
during early development, before the PostgreSQL cutover. These SQL files
are SQLite syntax and are NOT compatible with the current Postgres schema
— they're kept here for historical reference only, not for replay.

The switch from SQLite to Postgres required a fresh migration chain
because the two dialects generate fundamentally different SQL (column
types, constraint syntax, etc for the same logical schema) — there is no
meaningful way to "port" a SQLite migration file to Postgres SQL; the
new chain in `../drizzle/` was generated fresh from the same logical
schema, now expressed in Drizzle's pg-core.

No production data existed on the SQLite chain at the time of this
cutover — this was a development-stage database, not a data migration.
