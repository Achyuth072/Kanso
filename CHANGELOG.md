# Changelog

## v1.20.1 — May 2026

- Changelog popup: see what changed since your last visit, version-aware
- Notifications now layer correctly above all dialogs, drawers, and FABs
- "What's New" indicator moved into the mobile header
- Focus timer sliders persist correctly across navigations
- List view drag ghost no longer snaps to the wrong position after a drop
- Guest mode account section fully restored

## v1.20.0 — May 2026

- **Time format preference** — global toggle for 12-hour, 24-hour, or system default
- **Strict vs Flexible recurrence** — strict anchors repeats to the original due date; flexible anchors to when you actually completed it
- **Data export / import / delete** — full control over your cloud data (registered users)
- **uhabits import** — import habit history from Loop Habit Tracker `.db` files
- Tasks can now be dragged between groups when grouped by project, priority, or date
- Mobile calendar supports swipe gestures for navigation — chevron buttons removed
- Esc closes any open modal or drawer, globally

## v1.19.1 — May 2026

- Focus timer sliders no longer reset when switching tabs or navigating away
- Guest mode loads faster with no unnecessary network calls

## v1.19.0 — May 2026

- Dialog and sheet animations rewritten in native CSS — no more jank on mid-range phones
- Task list rendering scales linearly — stays fast with 500+ tasks
- Completed tasks remain visible (crossed out) until the end of the day
- Timer state isolated — the ticking clock no longer causes the whole app to re-render
- Stats page handles years of history without slowing down
- Time picker replaced with a native input — lighter and respects your system locale
- Going offline no longer redirects to the login page

## v1.16.0 — Apr 2026

- Full visual design system pass: shadows removed, icon stroke weights unified, matte surfaces throughout
- Monthly calendar reworked with a dynamic elastic grid — correct for 4, 5, and 6-week months
- Color and habit palettes standardized across every screen
- Mobile sidebar no longer jitters when opening or navigating on small screens
- All primary action buttons aligned to a consistent height and type size

## v1.15.0 — Apr 2026

- Mobile drag-and-drop now uses distance-based activation — less accidental triggers while scrolling
- Kanban columns remember manual reorder when you drag items
- Toast notifications use natural widths instead of a fixed viewport percentage

## v1.14.0 — Apr 2026

- **WebDAV sync** — sync your Guest Mode data to a personal server (Nextcloud, Synology, ownCloud) with no account required
- **ZIP backup and restore** — export everything as a portable archive; import it on any device
- Weekly backup reminder so your local data is never at risk
- Backup & Sync settings section added for Guest Mode users

## v1.13.0 — Mar 2026

- Sidebar open/close is now animated with tuned spring physics
- Active filters and sort orders show a visible indicator in the toolbar
- Command menu synced with all keyboard shortcuts — everything discoverable in one place
- Habit cards match task card styling and density
- Android keyboard no longer pops up automatically when a create or edit drawer opens
- Stats heatmap auto-scrolls to the current week on load

## v1.12.0 — Mar 2026

- **Native calendar event creation** — FAB on mobile, inline on desktop, with natural language time input ("lunch tomorrow at 2pm")
- **ICS import / export** — import from Google Calendar, Apple Calendar, or any `.ics` source; export for full portability
- **CalDAV sync** — bidirectional sync with Nextcloud, iCloud, Fastmail, and any CalDAV server
- Google Calendar and Microsoft Outlook sync _(in progress)_
- Tasks and calendar events are now visually distinct in all views
- Overflow events in month view are tappable and open a day summary popover
- Project deletion moved to a native-style Drawer on mobile
- FAB no longer shifts down when navigating to the Calendar page

## v1.11.0 — Mar 2026

- Drag-and-drop rebuilt with a flat DOM structure — 60fps on all devices
- Project archive flow: choose to move tasks to Inbox, delete them, or keep them
- Archived project tasks no longer appear in task lists
- Haptic feedback standardized with a typed semantic pattern system
- Global sync indicator suppressed in Guest Mode (nothing to sync)
- Edit and delete project actions accessible from mobile sidebar

## v1.10.0 — Feb 2026

- **Offline-first PWA** — the app loads from cache instantly with no network required
- Branded offline page replaces the browser error screen when disconnected
- **Magic Link sign-in** — passwordless, no password to forget
- Service worker prevents TCP hang on slow or stalled connections

## v1.9.0 — Jan 2026

- **Live "Now" line** in the calendar — updates every minute; auto-scrolls to the current time on open
- Habit completions appear in the Stats dashboard and Activity Heatmap as a unified momentum metric
- Kanban columns shrink to their content — no more empty ghost columns

## v1.8.0 — Jan 2026

- **Habit tracking** — create, edit, and delete habits with streak tracking and longevity insights
- Mobile sidebar reliably closes and routes without swallowing the navigation event

## v1.7.0 — Jan 2026

- **Activity Heatmap** — GitHub-style consistency chart combining task completions and focus sessions into a single daily score

## v1.6.0 — Jan 2026

- **Split view** — List View on desktop opens a resizable detail panel alongside the task list
- **Play button** on every task card — starts a focused session instantly; hover-revealed on desktop, always visible on mobile

## v1.5.0 — Jan 2026

- Push notifications for due dates and morning briefings (PWA)
- Haptic feedback tuned across all interactive elements — taps, toggles, and completions each have a distinct feel

## v1.4.0 — Dec 2025

- **Recurring tasks** — daily, weekly, monthly, and custom intervals
- Task completion triggers a satisfying haptic and visual confirmation

## v1.3.0 — Dec 2025

- **Projects** — organize tasks into color-coded projects with their own views
- Keyboard shortcuts for all major actions (`N`, `P`, `Ctrl+K`, `1–6`)

## v1.2.0 — Nov 2025

- **Focus timer** — Pomodoro-style sessions with configurable work and break lengths, PiP mode, and session history
- Stats dashboard with daily and weekly focus trends

## v1.1.0 — Nov 2025

- **Calendar** — day, week, and month views with task integration
- **Guest Mode** — full experience with no account, stored locally

## v1.0.0 — Oct 2025

- Tasks: create, edit, complete, reorder — across Grid, Board, and List views
- Supabase sync for registered users
