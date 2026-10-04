/**
 * Returns the current UTC time formatted as "YYYY-MM-DD HH:MM:SS" — the
 * same format SQLite's CURRENT_TIMESTAMP produced, which the rest of the
 * app already assumes (string comparisons for pagination/expiration,
 * `new Date(x + "Z")` parsing, etc). Used as an app-side column default
 * (`$defaultFn`) so it's evaluated identically regardless of which
 * database engine is behind Drizzle — no database-specific default
 * expression (`CURRENT_TIMESTAMP`, `now()`) needed, and switching from
 * SQLite to Postgres changes zero date-handling call sites elsewhere in
 * the app.
 */
export function nowTimestamp(): string {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}
