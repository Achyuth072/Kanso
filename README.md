# Kanso

A productivity built for deep work. Minimal interface, high information density no noise, no bloat.

## Key Workflows

### 1. Capture & Organize

- **Global Command Menu**: `Ctrl/Cmd + K` for instant search, navigation, and actions.
- **Micro & Macro Views**: Shift between **Masonry Grid**, **Board**(desktop only), and **List** views instantly with `1/2/3`.
- **Split View**: Desktop List View automatically opens a master-detail split panel.
- **Project Structure**: Multi-layered project management with archiving and mobile-native drawers.
- **Group & Filter**: Group tasks by project, priority, or due date with full drag-and-drop across groups.

### 2. High-Fidelity Tracking

- **Habit Mastery**: Standardized habit tracking with haptic feedback, longevity tracking, and Loop Habit Tracker (uhabits)(.db) partial import support.
- **Activity Heatmap**: Track focus minutes and habit completions via a visual consistency chart.
- **Focus Timer**: PiP-enabled Pomodoro engine with real-time stats and background session detection.
- **Recurrence Modes**: Per-task Strict (anchor to due date) or Flexible (anchor to completion date) recurrence.

### 3. Calendar & Events

- **Native Event Creation**: Create calendar events directly from the calendar with an NLP-assisted time parser.
- **Multi-Provider Sync**: Bi-directional sync with Google Calendar(WIP), Microsoft Outlook(WIP), and any CalDAV server (Nextcloud, iCloud, Fastmail).
- **ICS Portability**: Universal `.ics` (RFC 5545) import and export for full calendar portability.

### 4. Data Ownership & Sync

- **Guest / Private Mode**: A zero-footprint experience running entirely in `localStorage` — no account required.
- **WebDAV Sync**: Sync guest data with personal servers (Nextcloud, Synology) without an account.
- **Export / Import**: Universal `.zip` backups and `.ics` (RFC 5545) portability.
- **Account Data Sovereignty**: Registered users can export, import, or permanently delete all cloud data.
- **Offline-First PWA**: Full offline support via a service worker with stale-while-revalidate caching and a branded offline shell.

### 5. Preferences & Accessibility

- **Time Format**: System-wide 12-hour / 24-hour / system toggle applied across all time displays.
- **Keyboard Accessible**: Esc closes all open modals; full focus-trap and `aria-modal` audit completed.
- **Haptic Feedback**: "Seijaku" haptic pattern system for precise mobile feedback on all interactions.

## Essential Shortcuts

| Shortcut            | Action                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `1 - 6`             | Quick Navigation (Home, Habits, Calendar, Stats, Focus, Settings) |
| `Shift + 1 / 2 / 3` | Switch View (Grid / Board / List)                                 |
| `Ctrl/Cmd + K`      | Open Command Palette                                              |
| `Ctrl/Cmd + B`      | Toggle Sidebar                                                    |
| `N / H / E / P`     | Create New (Task, Habit, Event, Project)                          |
| `Shift + H`         | View all Shortcuts                                                |

## Get Started

1. **Web App**: [usekanso.vercel.app](https://usekanso.vercel.app)
2. **Guest Mode**: Try the full experience instantly, no account required.

## Built with

- **Next.js 16.1.0 (App Router)** and **Supabase (Postgres/Realtime/SSR)**
- **TanStack Query v5.90+** (Persistence via IndexedDB) and **Zustand v5**
- **React 19.2.3** (Pre-optimized for Concurrent Mode + React Compiler)
- **Tailwind CSS v4** and **Shadcn UI** (Radical Minimalism)
- **Framer Motion** and **@dnd-kit** (Optimized Flat-DOM implementation)
- **Serwist** for Typed Service Worker & Offline-First PWA support
- **react-activity-calendar** and **Recharts** for data visualization
- **tsdav** and **ical.js** for CalDAV / ICS calendar sync and portability

## Setup

### Prerequisites

- Node.js 20+
- A Supabase project with the schema from `supabase/schema.sql`

### Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment:
   ```bash
   cp .env.example .env.local
   ```
   _Add your Supabase keys to .env.local_
4. Start the dev server:
   ```bash
   npm run dev
   ```

## License

[AGPL-3.0](./LICENSE)
