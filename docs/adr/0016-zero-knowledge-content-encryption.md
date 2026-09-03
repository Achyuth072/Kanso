# Registered content is encrypted so Kagelin cannot read it; its metadata is not

A Registered user's **content** — task and habit names, notes, event titles,
locations, project and label names — is encrypted on the device before it
reaches Supabase, under a key Kagelin never holds. The **shape** of that content
is deliberately left readable: dates, priorities, durations, completion state,
recurrence. Kagelin can therefore tell you have four things due Tuesday
afternoon, and cannot tell what any of them are.

This closes the five threats that actually end a product — a stolen database
dump or R2 backup, a leaked service-role key, a mistaken RLS policy, a breach at
Supabase, and legal compulsion — by making all of them return ciphertext. It
does not close XSS, and is not intended to: see
`0017-libsodium-wrapped-master-key.md` for where that boundary sits.

## This is not the "registered but local-only" mode rejected in ADR 0015

The distinction is easy to lose and worth stating plainly. ADR 0015 rejected an
account whose content **never leaves the device**, partly because "with no rows
in Postgres nothing is ever scheduled" — reminders are a database trigger on
`tasks` feeding `notification_queue`, so a local-only account would have a
Reminders UI that does nothing.

Encryption is the opposite arrangement. The rows **are** in Postgres. Only the
text is opaque; `due_date` and `do_date` are ordinary readable columns, so the
trigger fires exactly as it always did. What changes is that the trigger stores
the encrypted title instead of interpolating the plaintext one, and the service
worker decrypts it before display. ADR 0015's rejection stands untouched.

## Considered options

- **Encrypted at rest with Kagelin-held keys** (what Todoist, TickTick, Notion
  and every mainstream competitor do). Rejected: it defends against a stolen
  backup and nothing else, and specifically does not stop the operator reading
  everything — which was the actual motivating complaint. Shipping it under the
  banner "user data encryption" would claim a property we hadn't built.
- **Break-glass — encrypted, with a logged, deliberate operator decryption
  path.** Rejected as the same cryptography with process on top: the guarantee
  that can honestly be advertised is identical to the option above.
- **Encrypting metadata too.** Rejected: it destroys every filter and sort the
  app has, all of which run on dates, priority, project and completion, and it
  turns a shippable feature into a research project. Lunatask — the closest
  comparable product, E2EE tasks _and_ habits — draws the line in exactly the
  same place.
- **Opt-in rather than universal.** Rejected: opt-in privacy features see
  single-digit adoption, so a breach still exposes nearly everyone and the claim
  cannot honestly be made. Universal for new accounts; the existing invite
  cohort is migrated in a forced client-side pass while it is still small.

## Consequences

- **Server-side features that need the words are permanently foreclosed** —
  search, semantic dedupe, summarisation, auto-tagging, anything Kagelin-operated
  reading task text. Structural server logic is unaffected, and _client-side_ AI
  (in-browser models, local Ollama, bring-your-own-key) remains entirely
  possible. This was accepted deliberately, not overlooked.
- **Reminders keep working, but render on the device.** Both notification
  triggers — the one on `tasks` and the one on `user_timer_state` — and the
  briefing job compose payloads they cannot read; the service worker decrypts
  before display. Where the key is unavailable — a fresh device, or a **Locked**
  app — notifications degrade to naming a count rather than an item. A PWA cannot
  schedule notifications locally (the Notification Triggers API was cancelled),
  so server push is not optional here.
- **Forgetting both the passphrase and the recovery code destroys the data**,
  and Kagelin cannot help. This is what the guarantee means.
- **Support becomes consensual.** Users can still hand over data, logs or an
  export; Kagelin can no longer take it. Scrubbed error reporting keeps stack
  traces and loses content, which historically would still have caught our real
  bugs.
- **Identity is never covered.** `auth.users` is Supabase-managed, so Kagelin
  always knows who its users are and how often they appear. Any copy claiming
  otherwise is false.
- **Anything holding content is in scope, including the non-obvious.** The raw
  uhabits import blob, the calendar `metadata` JSONB, and free-text error columns
  each defeat the scheme on their own if missed.
- **Google- and Outlook-synced events remain plaintext at the provider.** The
  guarantee is about Kagelin's servers, and the wording must say so.

## Amended — how "scrubbed, not encrypted" is enforced

`external_calendars.sync_error` and `notification_queue.error_message` stay
readable so an operator can triage a failed sync or a failed push. They are
therefore only ever written with a hardcoded literal, or with the output of
`describeError()` (`src/lib/errors/describeError.ts`, mirrored for Deno in
`supabase/functions/_shared/errors.ts`).

`describeError()` builds its result from a fixed vocabulary — error class name,
an opaque SQLSTATE or provider code, an HTTP status — and **discards
`.message`**. Filtering the message was rejected: Postgres constraint
violations and push/provider responses echo the rejected row or payload back
inside it, and no regex can be trusted to catch every shape of that. The
richer message still reaches the local console and the (scrubbed) error
reporter; it must not reach a column.

## Amended — what a queued notification may name

A `notification_queue.payload` carries generic copy in `body` plus, when the
producer has a ciphertext to hand, `encrypted: { template, ciphertext }` — a
body template with a `{}` placeholder and the item's stored ciphertext,
untouched. `displayNotification()` (`src/lib/notifications.ts`, the single
display seam the service worker already funnels through for iOS tag handling)
substitutes the decrypted text, and falls back to `body` when there is no key
or the ciphertext does not decrypt. A notification is always shown: on iOS a
push that displays nothing costs the subscription.

Two producers deliberately name no item at all, rather than pass a ciphertext
through:

- The **timer_end** chain is projected from `user_timer_state`, which holds no
  content. Reading `tasks.content` from that trigger — as it used to — put a
  task's text into a queue row a write to `user_timer_state` produced, which is
  exactly the leak nobody looks for. The body is generic; `data.taskId` still
  carries the deep link.
- The **morning briefing** Edge Function counts rows and selects `id`. It has no
  key, and a count needs no plaintext.
