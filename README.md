# Kanso (FocusM3)

_"The void is not empty; it is full of possibility."_

Kanso is a **Zen-Modernist** task management and focus tool. It fuses the Japanese philosophy of **Kanso** (simplicity) with **Swiss Modernism** to create a quiet, high-density environment for deep work.

## Core Philosophy: Zen-Modernism

- **Ma (The Void)**: We use active negative space to organize content, not borders or shadows.
- **Seijaku (Calm)**: All interactions feature physical, dampened weight for an energized sense of calm.
- **Ink & Matte**: High-contrast typography ("Ink") on flat, soft-matte surfaces.

## Key Workflows

### 1. Capture & Organize

- **Global Command Menu**: `Ctrl/Cmd + K` for instant search, navigation, and actions.
- **Micro & Macro Views**: Shift between **Masonry Grid**, **Board**, and **List** views instantly with `1/2/3`.
- **Project Structure**: Multi-layered project management with archiving and mobile-native drawers.

### 2. High-Fidelity Tracking

- **Habit Mastery**: Standardized habit tracking with haptic feedback and longevity insights.
- **Activity Heatmap**: Track focus minutes and habit completions via a visual consistency chart.
- **Focus Timer**: PiP-enabled Pomodoro engine with real-time stats.

### 3. Data Ownership & Sync

- **Private Mode**: A zero-footprint experience running entirely in `localStorage`.
- **WebDAV & CalDAV**: Sync with personal servers (Nextcloud, Synology, iCloud) without an account.
- **Export/Import**: Universal `.zip` backups and `.ics` (RFC 5545) portability.

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
- **TanStack Query v5.90+** (Persistence via IndexedDB) and **Zustand**
- **React 19.2.3** (Pre-optimized for Concurrent Mode)
- **Tailwind CSS v4** and **Shadcn UI** (Radical Minimalism)
- **Framer Motion** and **@dnd-kit** (Optimized Flat-DOM implementation)
- **Serwist** for Typed Service Worker & PWA support
- **react-activity-calendar** and **Recharts** for data visualization
- **tsdav** and **ical.js** for calendar synchronization and portability

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
