# Capture raw import source for future round-trip export

A streak is never exported — both uhabits and Kagelin recompute it at runtime
from entries plus a frequency schedule ([ADR 0005](0005-uhabits-frequency-import-approximation.md)).
So "export back to uhabits" is really about re-emitting the raw data, and the
import today throws raw data away: archived habits are skipped entirely,
`freq_num/freq_den` is approximated into `count/period`, SKIP entries and exact
color indices are dropped. None of it is stored anywhere.

That loss happens at import time and can't be recovered later — even a
perfect exporter can't reconstruct data nobody kept. So we capture the raw
source now and defer the exporter itself.

## Decision

At import, store the raw parsed `{ habits, repetitions }` verbatim:

- Registered/premium → one row in `habit_imports` (Postgres, RLS-scoped).
- Guest → appended to an IndexedDB list, not the mock-store localStorage blob
  (which re-serializes on every mutation and is capped near 5MB).

Each imported habit gets a `source_uuid` (uhabits' `uuid`) linking it back to
its row in `habit_imports`. Capture happens before dedup, so duplicates and
archived habits are preserved even though they don't end up in `habits`. It's
non-fatal — a capture failure is reported to Sentry but never blocks the
import.

We considered a raw-frequency passthrough column (what ADR 0005 flagged as
the real fix) but a whole-blob capture covers that and everything else
(archived habits, skips, colors, uuid) in one place, without committing to a
field list up front. We also considered archiving the original `.db` file,
but that needs Storage infra and isn't queryable.

## Consequences

- Supersedes the raw-frequency-column idea from ADR 0005 — `habit_imports.raw`
  already has `freq_num`/`freq_den`.
- The working import is unchanged: archived habits still don't show up in the
  UI. A future exporter reconstructs them from `habit_imports.raw`.
- `habit_imports` rows are a snapshot at import time — edits made in Kagelin
  afterward aren't reflected. The exporter will need to decide whether to
  export current state or reproduce the original; this baseline keeps the
  original.
- Rows are write-once (no UPDATE policy) and deletable, so "delete my data"
  can clear them.
- This makes round-trip export possible later. It does not build it — no
  export writer ships here.

## Amended — the captured blob is encrypted for registered users

`habit_imports.raw` and `file_name` are now encrypted client-side before they
reach Supabase (ADR 0016). The blob holds every habit name and every entry
verbatim, so leaving it readable while encrypting `habits.name` would have
achieved nothing.

`raw` stays a `JSONB` column but now holds a ciphertext envelope — a JSON
string, not an object. The future exporter must read it through the encrypting
client, which serializes on write and parses on read, so the parsed source
round-trips unchanged. Nothing may query into it with JSONB operators, and
nothing server-side can read it. `source_app` and `created_at` stay readable.

Guests are unaffected: their capture never leaves the device, so it stays as-is
in IndexedDB.
