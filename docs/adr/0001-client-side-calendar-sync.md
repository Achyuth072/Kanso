# Client-side calendar sync with token-in-memory

Google/Outlook calendar sync runs in the browser. Adapters call provider APIs
directly with a short-lived access token held in memory only. A separate OAuth
consent flow stores the refresh token server-side (encrypted AES-256-GCM); our
token endpoint (`/api/calendar/token`) decrypts and mints access tokens on demand.
Refresh token never touches the browser.

This keeps on-demand sync free — users spend their provider API quota, not ours.
That's the whole point of offering Google/Outlook to free users (background
auto-sync is the paid tier). Also avoids rewriting the existing adapters.

## Considered options

- **BFF token proxy** — token stays server-side; browser calls our endpoint.
  Rejected: every API call flows through our compute, killing the free-tier premise.
- **Server-side sync** — adapters in an edge function. Rejected: same compute cost,
  plus rewrite, and it adopts paid-tier economics before paid tier exists.

## Consequences

- Access token lives in browser memory for ~1h. Bounded by expiry, never persisted;
  XSS on a logged-in session can already hit our DB, so this is incremental risk.
  Compensate with CSP (Phase 61).
- Google/Outlook require login (OAuth needs server-anchored refresh token identity).
  Guests keep CalDAV with client credentials. Technical boundary, not paywall.

## Amended — CalDAV deferred at every tier

The CalDAV half of the last consequence no longer holds. The connect flow was
withdrawn pre-beta because it wrote server URL, username and password to
`localStorage` in plaintext, and it has not been rebuilt. No tier has CalDAV
today, so Guests do not have a calendar story at all — the "technical boundary,
not paywall" reasoning above still stands as intent, but describes something
that does not currently exist.

Rebuilding it is blocked on a genuine open question rather than effort: where a
credential lives when there is no account to anchor it to. In-memory-only works
for **WebDAV backup**, which is a deliberate button press, but not for calendar
sync, which fires on app open, window refocus and a post-edit debounce — a
Guest would be retyping a password several times a day, or the sync would simply
never run. Solving it means either a passphrase-derived key in the browser or
server-held credentials, and the second forecloses the Guest case that motivated
this decision. Deferred pending its own design pass.

The rest of this ADR — client-side adapters, token-in-memory, refresh token
server-side — is unaffected and still current for Google/Outlook.

## Amended — synced events are encrypted at Kagelin, plaintext at the provider

Event titles, descriptions, locations, categories and the `metadata` JSONB are
now encrypted before they reach Supabase (ADR 0016). Sync is unaffected: the
adapters run in the browser behind the encrypting client, so they read and write
plaintext, and only Kagelin's own storage sees ciphertext. Times, the all-day
flag, colour, recurrence rule and the provider-side identifiers (`remote_id`,
`etag`, `ics_uid`, `sync_token`) stay readable — every calendar view and the
sync merge itself depend on them.

The guarantee is therefore about Kagelin's servers only. An event pulled from
or pushed to Google or Outlook is stored in plaintext **at that provider**,
under that provider's terms, exactly as it was before. User-facing copy must
not imply otherwise.
