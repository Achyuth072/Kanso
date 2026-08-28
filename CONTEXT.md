# Kagelin — Domain Glossary

The canonical vocabulary for Kagelin. This file is a glossary, not a spec — it
defines what terms _mean_, never how they're implemented. When a term here
conflicts with how something is being described in a plan or PR, the conflict
must be resolved before proceeding.

---

## Sync (disambiguated)

"Sync" is overloaded and must always be qualified with one of the following.
Three are distinct sync features with very different server-compute costs; the
fourth entry is here because it is routinely mistaken for one.

### On-demand calendar sync

A calendar pull/push initiated **on the user's own device** (opening the
calendar, "Sync now", a debounced post-edit push, window refocus). The browser
talks **directly** to the provider using the user's own access token and API
quota. Kagelin's only server cost is an occasional access-token refresh. Cheap.
Available to **registered users** (free tier included).

Google and Microsoft are the providers. **CalDAV is deferred at every tier** —
it was withdrawn pre-beta and no tier has it. Naming CalDAV as something a user
can connect today describes an intention, not the product.

_Not to be confused with_ realtime cross-device mirroring or background
auto-sync.

### Realtime cross-device mirroring

Live propagation of a user's **content** — tasks, habits, events — between
their devices over Supabase Realtime. Costs ongoing server compute that scales
with connected devices. A **paid / premium** capability, and not yet built.

The focus timer is **not** an instance of this, despite using the same
transport. See **Timer handoff**.

### Timer handoff

The running focus timer following the user between their devices, so pausing on
a laptop pauses on the phone. Available to **every registered user**, free tier
included, and deliberately carved out of realtime cross-device mirroring rather
than being a free-tier leak of it.

The distinction is one of kind, not of generosity. Mirroring propagates content
the user authored, and it is a convenience — a task that shows up a minute later
on another device is merely slow. A timer is a **single piece of state that can
only be in one place**: one row per user, bounded, with no history. A timer that
stops here and keeps running there isn't unsynced, it is **wrong**, and a
Kagelin that reports two different remaining times is broken at any tier.

_Avoid_: "timer sync", which collapses it back into the thing it is not.

### Background / scheduled auto-sync

Server-side synchronisation that runs **even when the user is not in the app**
(e.g. a cron keeping calendars fresh). Costs ongoing server compute that scales
with users. A **paid / premium** capability, deferred.

### WebDAV backup (deliberately _not_ "WebDAV sync")

Manual **Back Up** / **Restore** of the user's whole dataset as a **Backup** on
a WebDAV server they own (Nextcloud, Synology, …). Available at **every tier**:
a Guest's Backup is built from their local data, a Registered user's from their
cloud tables, and the resulting file is the same artifact either way.

**Not** sync, and the UI must never call it sync. It has no conflict model at
all: the file lives at one fixed path, every Back Up overwrites it wholesale,
and nothing compares timestamps in either direction. Two devices backing up in
turn silently discard the earlier one. Calling it "sync" would promise a
convergence the mechanism cannot deliver — see
`docs/adr/0015-webdav-is-backup-not-sync.md`.

- **Back Up** — overwrite the file on the server with the user's current data.
  Reads only; never modifies the user's data.
- **Restore** — make the user's data match the file, **and nothing outside the
  file survives**. Destructive, so it is always confirmed, and the confirmation
  names the date the Backup was taken.

What it deliberately excludes: connected calendar accounts, focus-timer state,
and import provenance. Calendar connections in particular carry OAuth material,
which must never be written to a third-party server.

_Not to be confused with_ realtime cross-device mirroring: nothing propagates
until a person presses a button.

---

## Accounts and sign-in

### Account

The person's single record in Kagelin — one `auth.users` row, one `auth.uid()`.
Tiers attach to an Account. A **Guest** has no Account at all, which is what
"no server identity" means.

### Identity

One proven way into an Account. An Account has one or more, each recording the
**Provider** that vouched for it. Not a synonym for Account: "my GitHub
identity" is a way in, not a second person.

### Provider

The issuer standing behind an Identity — Google, GitHub, GitLab, or `email` for
anything Kagelin verifies itself.

### Sign-in method

What the login page actually offers. Deliberately **not** one-to-one with
Provider: password and magic link are two methods over the single `email`
Provider, while "Continue with GitHub" is one method over one Provider. Guest
is not a sign-in method — it creates no Account.

### Linking

Attaching an additional Identity to an Account that already exists, so a second
Provider signs into the same data. Two kinds, both supported:

- **Automatic** — the Provider vouches for an email Kagelin already holds as
  verified, and the Identity joins that Account with no one asking.
- **Manual** — the signed-in user attaches a Provider deliberately, from
  Settings. The only route when the emails differ.

Linking is not **merging**, and the distinction is the whole point: linking
only ever attaches an Identity that belongs to nobody yet.

### Merging

Consolidating two Accounts that both already exist, into one. Kagelin does not
do this — there is no self-serve path and no feature. A person who reaches two
Accounts has two sets of data, and recovering from that is an operator action.
See `docs/adr/0012-identity-linking.md`.

### Signed out

No session on this device. The Account still exists; this device is simply not
authenticated to it. Getting back in goes through a **Provider** — a password, a
magic link, an OAuth round-trip.

### Locked

The session is intact, but the device has discarded the means to read the
Account's **content**: the key and every decrypted copy of the data. Unlocking
asks for the passphrase only — no Provider, no email, no network.

**Locked and Signed out are not degrees of the same thing.** Locking is about
content; signing out is about identity. A Locked app is still signed in. A
Signed-out app is not "locked" — it has nothing to unlock, because signing out
discards the key too.

Locking is a **user choice**, not a protection Kagelin relies on: it addresses a
shared or stolen unlocked device, nothing else. It is always available as a
deliberate action, and may additionally be set to happen after a period of
inactivity — off by default, because while Locked, reminders can no longer say
_what_ is due, only that something is.

_Avoid_: "log out to lock", which implies one is a way of doing the other.

---

## Tiers

### Guest

An unregistered user. Data is local-only, with **Backup** export/import and
**WebDAV backup** for portability. Has no server identity (`auth.uid()`).

Guest is Kagelin's **local-only tier**, not a trial state to graduate out of. A
person who wants their data never to reach Kagelin's servers is already served:
stay a Guest, and back up to a server you own. There is deliberately no
"registered but local-only" mode — an account whose content stays on the device
would be a Guest that also cannot receive reminders, since reminders are
scheduled from the data server-side.

**Encrypted content is not that mode**, and the two must not be collapsed. An
encrypted Registered account's rows _do_ reach Kagelin's servers; the server
simply cannot read what they say. Their schedule stays legible, so reminders are
scheduled exactly as before. The line is **where the data lives**, not whether
Kagelin can read it: a Guest's content never arrives, a Registered user's
arrives unreadable. See `docs/adr/0016-zero-knowledge-content-encryption.md`.

Cannot use Google/Outlook calendar, which structurally requires a
server-anchored identity. **CalDAV is deferred at every tier**, so it is not a
Guest capability either.

### Registered (free)

A user with a Kagelin account (`auth.uid()`). Data persists to the cloud. Gets
**on-demand calendar sync**, **WebDAV backup**, and **timer handoff**. Does
**not** get realtime cross-device mirroring, background auto-sync, or push.

Content is **encrypted**: what the user wrote — task and habit names, notes,
event titles and locations — is unreadable to Kagelin. What the user _scheduled_
is not: dates, priorities, durations and completion remain legible, which is
what lets reminders and analytics keep working. Identity is never covered —
Kagelin always knows an Account exists and what its email is. Say this
precisely; "your data is encrypted" overclaims. See
`docs/adr/0016-zero-knowledge-content-encryption.md`.

### Premium (paid)

A registered user with the Premium entitlement. Adds realtime cross-device
mirroring, background auto-sync, and push notifications on top of the
registered-free capabilities. Usually paid for, but a **founding grant** confers
the same entitlement without payment — the tier records the entitlement, never
its source.

---

## Guest showcase content

### Demo data

The fabricated tasks, projects, habits, habit entries, focus logs and calendar
events a **Guest** is given on arrival, so the app is populated on first sight
rather than empty. It exists to showcase Kagelin — to someone evaluating it from
a résumé, and to a prospective user who has no wiki or docs to read instead.
Demo data is a **Guest**-only concept: it is never created for a Registered or
Premium user, and never reaches the cloud.
_Avoid_: "mock data" (the legacy spelling, surviving in the `src/lib/mock/` path
and the `mockStore` singleton); _avoid_: "sample data", "dummy data".

### Demo item

One record within Demo data. Demo-ness is a property of the **record**, tracked
per id, not of the account or the session — a Guest's own tasks sit alongside
Demo items in the same store. Internally the id list is spelled `seed_ids` and
the predicate `isSeedId`; **seed** is the code spelling of **demo** and carries
no separate meaning.

Demo-ness is **permanent and inherited**: editing a Demo item does not make it
the Guest's own, and completing a recurring Demo item makes the next occurrence
a Demo item too. See
`docs/adr/0014-demo-data-stripped-on-signup-migration.md`.

### Demo mode

The state of a Guest whose store still contains at least one Demo item. It is
what the demo bar reports, and it ends only when no Demo item remains.
Not a tier and not an entitlement — a Guest is in Demo mode by default and
leaves it by clearing, never by upgrading.

### Start fresh

The Guest-facing action that empties the store — **all** of it, Demo items and
the Guest's own records alike — leaving Demo mode behind. Deliberately not a
demo-only removal: a partial clear would leave surviving Demo items whose
demo-ness has to be re-adjudicated, and there is no defensible answer for a Demo
project that now holds the Guest's real work. Destructive, so it is always
confirmed.
_Avoid_: "reset", which in the UI means the opposite — **Reset Demo** restores
Demo data rather than removing it.

---

## Founding cohort

### Overview

The first N waitlist signups, N set by kagelin-web's `WAITLIST_FOUNDING_CAP`
env var (read once at module load, so changing it needs a redeploy — not
"without a deploy", an earlier wrong assumption). The cap closes silently:
once it is reached, later signups fall into the
**general** cohort and see the general-launch message instead. "Beta users" is
not a term here — membership in the founding cohort is the whole definition.

### Invited

A founding-cohort signup who has been emailed the offer. Records an action taken
by the operator; confers no entitlement and gates nothing. A signup can join the
app having never been invited, and being invited does not imply having joined —
the two facts are independent and neither orders the other.

### Founding grant

The Premium entitlement given for founding-cohort membership, in two phases:

1. **Free, for 1 year**, on a per-user clock starting at the grant date —
   not tied to when the beta period itself ends.
2. **Discounted, for life**, from then on. The discount itself never expires
   or gets re-evaluated — "permanent" means permanent, not "permanent until
   some future decision."

Earned by **joining the app while in the founding cohort** — not by being
invited. Distinguished from a paid Premium subscription by the grant date
recorded against the waitlist signup — that date is what phase 1's 1-year
clock runs from; a user with no such date holds Premium for some other
reason.

---

## Habits

### Habit

An intention the user tracks day-by-day. The umbrella term covering two kinds —
a Habit is always one or the other:

- **Boolean Habit** — done / not-done per day. The original and (for now) only
  kind with native tracking UX.
- **Measurable Habit** — each Entry carries a real quantity (pages read, km run)
  judged against a target. Schema and import only for now; no native entry UX yet.

A Habit also carries a **frequency** — how often it is meant to be done
(e.g. daily, or three times a week). "Three times a week" _is_ expressible.
_Avoid_: Goal, routine, task.

### Entry

The record of a Habit on a specific date. What counts as **done** depends on the
Habit kind:

- **Boolean Habit**: done iff `value: 1`. The absence of an Entry and `value: 0`
  both mean "not done."
- **Measurable Habit**: done iff the day **meets its target** — for an `at_least`
  target, the logged quantity ≥ target; for `at_most`, ≤ target. An absent day
  reads as quantity `0`.

### Entry state (done / not done / skipped / unknown)

The canonical vocabulary for a day's status, mirroring the source trackers we
import from:

- **Done** — the target was met (see Entry).
- **Not done** — explicitly missed.
- **Unknown** — never logged. Indistinguishable from "not done" in our model.
- **Skipped** — deliberately not counted (a rest day): does not break a Streak
  and is excluded from Score.

Our store records only two of these — an Entry exists (with a `value`) or it
doesn't. **Done** and **not done / unknown** map cleanly; **Skipped has no
representation yet** and is collapsed to "not done" on import. Consequence:
imported habits that used the source app's skip feature show a slightly lower
Score and shorter Streaks than the original. Fidelity guarantees (and the Score
verification tests) are therefore scoped to **skip-free** habits until native
tracking introduces a real skipped state.

### "Done"-counting vs strength metrics (Measurable Habits)

The "absent reads as `0`" rule above feeds **Score** only (a continuous strength
0..1). Day-counting metrics — Streak, Best Streak, total completions — count only
days with a logged Entry that meets target, and for now are shown for **Boolean
Habits only**. This prevents an `at_most` Measurable Habit (e.g. "≤ 1 coffee/day")
from reading as an unbroken streak across every unlogged day.

### Streak

The current unbroken run of done-days ending at the present. A **trailing gap up
to today is _pending_, not a break** — the streak counts through the last done-day
and only breaks once the schedule has actually lapsed. So a 30-day run still reads
"30" all morning before today is logged.

The **pending window** is the Habit's own period: one day for a daily Habit (only
today is pending, exactly as before), one week for a 3×/week Habit. A frequency
Habit's computed run legitimately ends before today while the current period is
still open, so zeroing the streak there would be wrong. Once a full period passes
with no credited day, the streak lapses to 0. Measurable Habits fill in nothing
(see below), so they keep the one-day window. See ADR 0004.

**Frequency-aware**: for a non-daily Habit (e.g. 3× / week), a streak is _not_ a
run of consecutive calendar days the Habit was logged. The schedule first
**fills in** the days between reps that satisfy the frequency, and the run is
counted over those filled-in (computed) days — so flawless 3×/week adherence is
one long streak, not a break every off-day. A daily Habit fills in nothing, so
its streak is unchanged. (Mirrors the source tracker's interval interpolation.)
_Avoid_: Chain, run length.

### Best Streak

The longest such run in the Habit's whole history (the top few are surfaced).
Same frequency-aware, computed-day basis as Streak.

### Score

A Habit's **strength**: how consistently it has been kept, as a percentage. Unlike
a Streak (a binary run that resets to zero on a single miss), Score **decays and
recovers gradually**, is weighted toward recent days, and is normalized by the
Habit's frequency (so a 3×/week habit isn't penalized for its four off-days). A
Habit can hold a high Score with a Streak of zero — strong for months, missed
yesterday. The exact computation is ported faithfully from the source tracker so
an imported Habit shows the number the user remembers.
_Displayed as_: "Strength" is the source tracker's UI label for the same number;
**Score** is the canonical term here. _Avoid_: Streak (a different metric).

A Habit's `Frequency` rendered as week-to-date completion — "2 / 3 this week,"
shown as a ring. It is **not a Goal**: a Habit has no Goal, only a Frequency, and
this is just that Frequency drawn against the current period. _Avoid_: Goal.

Every Habit is implicitly **daily** (`1 / day`) — there is no "unset" state. The
progress ring is shown only when the target is **non-trivial** (more than once a
day, or a week/month period); a plain daily habit's "1 / 1" ring is redundant
next to the done/not-done toggle and is suppressed. The Frequency ring is shown
for **Boolean Habits only** (a Measurable `at_most` habit would read misleadingly
against a raw count), matching the day-counting-metric gate.

Frequency is authored as **times per day or week**; `month` is accepted in the
model for import fidelity but is not offered in the create/edit control (it stays
editable only on a Habit that already carries it). Frequency is **not
effective-dated**: it is a single current value, so editing it recomputes the
_entire_ Frequency grid and streak history against the new target — accepted as a
known tradeoff rather than snapshotting frequency per period.

---

## Goals

### Goal

A user-set target on a **global aggregate** — daily or weekly **focus-hours**, or
daily or weekly **tasks-completed**. Stored in preferences, set in Settings →
Goals, and shown as rings / bars on `/stats`. The word `Goal` names **only** these
global targets. There is **no per-item Goal**, no Goal attached to a Habit (a
Habit has a Frequency; see Frequency progress), and **no arbitrary-Goal entity** —
the four globals are the whole feature. _Avoid_: using "goal" for a Habit's
frequency or for any per-item target.

---

## Recurring tasks

### Recurrence

The rule on a task that makes it repeat ("every Monday"). A task either has a
Recurrence or it is one-off.

### Series

The durable identity tying together every dated instance of one recurring task
across time. The Series is what **survives a rename** — without it, occurrences
are related only incidentally (by matching content + project + date), so renaming
a task orphans its history. The Series is the fix for that.

### Occurrence

A single dated instance belonging to a Series. When a recurring task is completed,
the next Occurrence is spawned and carries the same Series identity.
_Avoid_: instance, spawn, **chain** (also banned for Streak).

---

## Tasks

### Step

A single named item in a task's **checklist**. Steps are the user-facing concept;
the underlying record is a `tasks` row with `parent_id` set to the containing
task's id.

A Step carries only a name and a completion state — it has no due date, start
date, priority, project, or notes of its own. The UI deliberately does not expose
the full task schema on a Step. The **code** calls these records "subtasks"
(`SubtaskList`, `useSubtasks`, `draftSubtasks`, `parent_id`); the **UI** calls
them "steps" ("Add a step…", "3 steps"). Neither spelling is wrong in its own
layer, but the two must not be mixed: a spec or PR that calls a step a "subtask"
in user-facing copy is using the wrong term.

Steps are **flat**: a Step cannot itself have Steps. The database supports
arbitrary nesting via `parent_id`, but the UI enforces a single level.

_Avoid_: "subtask" in UI copy or user-facing strings; _avoid_: "checklist item"
(inconsistent with the label already in the product).

### Step promotion _(deferred)_

The future action of converting a Step into a full top-level Task, so it gains
its own due date, priority, notes, and project. No schema change is required —
the record is already a `tasks` row; promotion removes the `parent_id` and
surfaces it as a peer task. Not yet built; noted here to prevent the concept from
being invented under a conflicting name.

---

## Analytics

### Stats

The **app-wide** analytics surface at `/stats`: everything aggregated across all
habits, tasks, and focus — period selector, breakdowns, time-of-day heatmap,
per-habit Score comparison. Global scope only.

### Insights

The **single-item** analytics surface, reached via the **Edit / Insights** toggle
inside one Habit's or one recurring Task's edit sheet. Scoped to exactly one item.
A Task has Insights only when it belongs to a Series. "Habit stats" is a misnomer —
that surface is **Habit Insights**; `Stats` always means the global page.
_Avoid_: "stats" for a per-item view.

### Backup vs Stats export

Two distinct things that both say "export":

- **Backup** — full portability: the complete dataset as a ZIP (JSON + ICS),
  round-trips with Import. **One artifact, however it travels.** The file a
  **WebDAV backup** leaves on the user's own server is the same ZIP the Export
  button produces — pull it off that server, hand it to Import, and it restores.
  A second, WebDAV-only format would make the escape hatch a dead end, since the
  file would only be readable by the button that wrote it.
- **Stats export** — a read-only analytics extract (CSV daily rollup / JSON stats
  payload), scoped to the current period or one item's Insights. Not a backup;
  does not round-trip.

### Telemetry (vs Stats / Insights)

Anonymous, opt-in product analytics sent to Kagelin's server (`/api/telemetry`)
to measure aggregate app health, adoption, and feature engagement (PWA install
ratio, timer completion, habit consistency, signups). Strictly zero PII (no
titles, notes, emails, or IP addresses stored), using an unlinked client-generated
device ID.
_Avoid_: conflating "Telemetry" (operator-facing app health) with "Stats"
(user-facing personal productivity analytics).

---

## Notifications (disambiguated)

"Notification" is overloaded across three unrelated mechanisms and must always be
qualified. They differ in who renders them and whether they survive the app being
closed.

### Toast

An in-app message rendered by Kagelin itself, at the bottom of the viewport. Exists
only while the page is open and dies with it. Every Toast is **one line of text plus
at most one action** — a Toast never carries both a secondary description line and an
action button, and only one Toast is on screen at a time. Used for confirmations,
errors, and undo affordances.
_Avoid_: calling a Toast a "notification" — it never reaches the OS.

### Local notification

An OS-level notification raised by the running page for something that just happened
in this same process (e.g. a focus session completing while the tab is backgrounded).
Reaches the system tray, but requires the app to still be running.

### Push notification

An OS-level notification delivered through the service worker from Kagelin's server.
The only mechanism that reaches the user with the app fully closed. "Notification
settings" in the UI means **Push notification settings** specifically — the
permission and subscription flow — and governs neither Toasts nor Local
notifications.

### Backup reminder

The periodic nudge to a **Guest** to export a Backup, because Guest data exists only
on that device. It is a **Toast**, not a notification of any kind, and is unrelated
to the push permission flow. Its **cadence** is how often the user may be nudged —
not merely how stale a Backup must be before nudging becomes eligible. Registered
and Premium users have no Backup reminder; their data is cloud-persisted.
_Avoid_: "backup notification"; _avoid_: "biweekly", which ambiguously means both
twice a week and every two weeks.

---

## Installation

### Installed

Kagelin launched from the Home Screen or app launcher rather than a browser tab.
A property of **one device**, not of an Account — the same person is Installed on
their phone and not on their laptop, and the server never knows either way. It
confers no entitlement and belongs to no Tier: a Guest can be Installed and a
Premium user need not be.

Load-bearing asymmetry: on iOS, **push notifications require Installed** — the
capability is absent from a browser tab and appears only once the app is on the
Home Screen. On Android it is a convenience, not a prerequisite.
_Avoid_: "the PWA" as a noun for this state; _avoid_: "app mode".

### Standalone

The display mode a browser reports when the app is **Installed** — the signal by
which Kagelin recognises the state. Not a synonym for Installed: Standalone is
how we can tell, Installed is what is true.

### Add to Home Screen

The user-facing name for becoming **Installed** on iOS, matching Apple's own
share-sheet wording. Android's equivalent is **Install**. These are the only two
phrasings used in the UI — the platform's own word, never a third invented one.

---

## Calendar views

### Week

Sunday–Saturday, always 7 days. One concept at every viewport size — what
changes on narrow viewports is how much of it is on screen at once (see Day
window below), never the span itself.

### Day window

The contiguous run of days visible at once within a Week: all 7 on desktop,
3–6 on narrow viewports (derived from available width, clamped to that
range). Scrolling moves the window; it does not change the Week. Not to be
confused with the rolling view below, which isn't bounded by the Week at all.

### Rolling view (3-Day / 4-Day)

The `3day`/`4day` calendar views: a today-anchored span that starts at
`currentDate` and pages by its own day count, crossing Week boundaries
freely. Unlike the Day window, it has no notion of a Week to clamp against —
the two can show different dates for the same day count near a Week
boundary; that divergence is intentional, not a bug (see ADR 0009).

`3day` (mobile) derives its day count from available width using the same
geometry as the Day window, so the two agree at every width where both can
appear. `4day` (desktop) stays a fixed count of 4. The `3-Day` label and the
`3day` view id don't change when the derived count is more than three —
three is the floor it guarantees, not a promise of exactly three. See ADR
0010 for the one width where this disagrees with the desktop breakpoint.

### Window scroll vs. Week paging

Two distinct things a horizontal gesture can do, and only one at a time:

- **Window scroll** — moves the Day window within the current Week.
- **Week paging** — replaces the Week entirely (advances/retreats it).

Paging only fires when the Day window was already parked at a Week boundary
when the gesture began — never mid-week. Conflating the two (letting any
horizontal drag both scroll the window and page the week) is the bug that got
mobile Week view removed in `51df6af`; see that commit and issue #24 before
changing the traversal mechanic.

### Bridge

The mobile Week view's implementation detail for Week paging: a temporary
14-day strip (the outgoing Week plus the paged-to Week) rendered only while a
swipe-triggered page is smooth-scrolling across the boundary, so the scroller
has real content to glide over instead of a hard cut. Collapses back to a
normal 7-day Week once the scroll settles. Not a user-facing concept — see
`MobileWeekGrid.tsx`.

---

## Navigation

### Cold open

The app starting directly at a non-root route with no history behind it — a
notification click, a PWA shortcut, a shared URL. Distinct from in-app
navigation, where the previous route is already on the history stack.
_Avoid_: cold start, deep link.

### Back anchor

The synthetic `/` history entry placed beneath a cold-opened route, so that in-app
back navigation has an in-app destination instead of exiting the PWA. Exists only
on cold open, and only for routes that are in-app destinations — an auth boundary
like `/login` is not one, and is never anchored.
_Avoid_: back trap, deep-link trap.

### Settled (back anchor)

The point at which the anchor is no longer in flight — either it is in place, or
the bounce that would have created it was interrupted. Back navigation waits for
settled, never for success, so a lost anchor degrades back rather than disabling it.

### Bounce

The two-step navigation that installs a back anchor: `replace("/")`, then
`push(<target>)`. The `/` render is real, not a repaint artifact, so a bounce is
visible — a beat of the tasks page before the target appears. Routes that cannot
afford that flicker are unanchored instead.
_Avoid_: redirect, double navigation.

### Unanchored route

A route that skips the bounce entirely — for one of two unrelated reasons, which
is worth keeping straight. For auth boundaries (`/login`, `/signup`, …) and
OAuth-connect returns, an anchor is impossible or pointless: the route redirects
away, or history already has entries, so skipping costs nothing. For admin routes
an anchor is possible and wanted, and is given up anyway to avoid showing the
bounce's `/` render as a flash — so those, and only those, exit the app on back.
_Avoid_: standalone route, bare route (both name **shell rendering**, a separate
concern that happens to cover the same paths).

### Pending bounce marker

A `sessionStorage` record of a bounce that started but never landed. A target that
404s cannot soft-navigate, so the return `push()` reloads the document and remounts
the shell — resetting the in-memory guard and re-arming the bounce forever. The
marker outlives that reload, so a second attempt at the same target stands down.
Without it, any URL that 404s looped at roughly two full page loads per second
until the tab was closed.

## Calendar connection

### Connect Calendar (vs. login identity)

The OAuth consent flow for _granting calendar access_ is **separate** from the
login/auth identity. A user logs into Kagelin via magic link; connecting a Google
or Outlook calendar is a distinct, additional consent with calendar scopes.

### Primary calendar / write target

Of the calendars discovered on a connected account, exactly one is the **write
target** — the calendar Kagelin-authored events are pushed to. It defaults to the
account's primary calendar. All other discovered calendars are read-only (pull)
display.

### Tombstone

A locally-deleted synced event that has not yet been removed from the remote
provider. It is retained (marked) only until the deletion is pushed remotely,
then hard-deleted locally.

### kansoId

Kagelin's own event `id` (UUID), stamped into the remote event at create time via
a provider-specific extended property (Google: `extendedProperties.private.kansoId`;
MS Graph: `singleValueExtendedProperties`). Returned on read so that a subsequent
pull can recognise a just-created event and adopt its `remote_id` / `etag` without
inserting a duplicate. Distinct from `remote_id` (the provider's own event
identifier) and from `id` (the local DB primary key, which happens to be the same
value).
