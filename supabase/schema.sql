-- Kanso Database Schema
-- Run this in Supabase SQL Editor

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- =============================================================================
-- 1. PROFILES TABLE (Extends Supabase Auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  settings JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'UTC',
  is_premium BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 2. PROJECTS TABLE (Lists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#D0BCFF',
  view_style TEXT DEFAULT 'list' CHECK (view_style IN ('list', 'board')),
  is_inbox BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 3. TASKS TABLE (The Core)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  description TEXT,
  priority INT DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),
  due_date TIMESTAMPTZ,
  do_date TIMESTAMPTZ,
  is_evening BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  day_order INT DEFAULT 0,
  recurrence JSONB,
  recurrence_settings JSONB,
  google_event_id TEXT,
  google_etag TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 4. LABELS TABLE (Tags)
-- =============================================================================
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#D0BCFF',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 5. TASK_LABELS TABLE (Join Table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS task_labels (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (task_id, label_id)
);

-- =============================================================================
-- 6. FOCUS_LOGS TABLE (TimeNoder Data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS focus_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 7. PUSH_SUBSCRIPTIONS TABLE (Web Push)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_key ON public.push_subscriptions (user_id, endpoint);

-- =============================================================================
-- 7.5. NOTIFICATION_QUEUE TABLE (Scheduled Alerts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('timer_end', 'due_date', 'do_date', 'evening', 'briefing')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS notification_queue_processing_idx ON public.notification_queue (scheduled_at, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_queue_user_id_idx ON public.notification_queue (user_id);

-- =============================================================================
-- 8. TRIGGERS: Auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 9. TRIGGER: Create Profile and Inbox on User Signup
-- =============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (use ON CONFLICT to avoid duplicates)
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  
  -- Create default Inbox project (only if not exists)
  INSERT INTO public.projects (user_id, name, is_inbox)
  SELECT NEW.id, 'Inbox', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.projects WHERE user_id = NEW.id AND is_inbox = true
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to the function
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;
GRANT ALL ON public.projects TO supabase_auth_admin;

-- Create trigger (note: cannot use OR REPLACE with triggers in PostgreSQL)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- 10. NOTIFICATION HELPERS & SYNC
-- =============================================================================

-- A. Morning Briefing Helper
CREATE OR REPLACE FUNCTION get_users_for_morning_briefing()
RETURNS TABLE (id UUID, timezone TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.timezone
  FROM profiles p
  WHERE 
    -- Is it 8 AM in their timezone?
    (now() AT TIME ZONE p.timezone)::time >= '08:00:00' 
    AND (now() AT TIME ZONE p.timezone)::time < '09:00:00'
    -- Haven't received a briefing in the last 20 hours
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue n 
      WHERE n.user_id = p.id 
      AND n.type = 'briefing' 
      AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

-- B. Evening Plan Helper
CREATE OR REPLACE FUNCTION get_users_for_evening_plan()
RETURNS TABLE (id UUID, timezone TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.timezone
  FROM profiles p
  WHERE 
    -- Is it 6 PM in their timezone? (18:00)
    (now() AT TIME ZONE p.timezone)::time >= '18:00:00' 
    AND (now() AT TIME ZONE p.timezone)::time < '19:00:00'
    -- Haven't received an evening plan in the last 20 hours
    AND NOT EXISTS (
      SELECT 1 FROM notification_queue n 
      WHERE n.user_id = p.id 
      AND n.type = 'evening' 
      AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

-- C. Task Notification Sync Trigger Function
CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER AS $$
DECLARE
  payload_title TEXT;
  payload_body TEXT;
  user_settings JSONB;
BEGIN
  -- 1. CLEANUP: If task is updated or deleted, cancel pending notifications for this task
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending';
  END IF;

  -- 2. CREATE NEW NOTIFICATIONS: If task is created or updated (and not completed)
  IF (TG_OP IN ('INSERT', 'UPDATE')) AND (NEW.is_completed = FALSE) THEN
    -- Fetch user settings to check preferences
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    -- i. Handle Due Date
    IF (user_settings->'notifications'->>'due_date_alerts')::boolean IS NOT FALSE 
       AND NEW.due_date IS NOT NULL AND NEW.due_date > now() THEN
      payload_title := 'Task Due Soon 🔔';
      payload_body := 'Your task "' || NEW.content || '" is due now.';
      
      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.due_date, 'due_date', 
              jsonb_build_object(
                'title', payload_title, 
                'body', payload_body, 
                'data', jsonb_build_object('url', '/today', 'taskId', NEW.id)
              ),
              NEW.id);
    END IF;

    -- ii. Handle Do Date
    IF (user_settings->'notifications'->>'do_date_alerts')::boolean IS NOT FALSE 
       AND NEW.do_date IS NOT NULL AND NEW.do_date > now() THEN
      payload_title := 'Time to focus 🚀';
      payload_body := 'Scheduled: ' || NEW.content;

      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.do_date, 'do_date', 
              jsonb_build_object(
                'title', payload_title, 
                'body', payload_body, 
                'data', jsonb_build_object('url', '/today', 'taskId', NEW.id)
              ),
              NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- D. Sync Trigger on Tasks
DROP TRIGGER IF EXISTS sync_task_notifications ON public.tasks;
CREATE TRIGGER sync_task_notifications
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION handle_task_notification_sync();

-- =============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects: Users can only access their own projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Tasks: Users can only access their own tasks
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      project_id IS NULL 
      OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid())
    )
  );
CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      project_id IS NULL 
      OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid())
    )
  );
CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Labels: Users can only access their own labels
CREATE POLICY "Users can view own labels" ON labels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own labels" ON labels
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own labels" ON labels
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own labels" ON labels
  FOR DELETE USING (auth.uid() = user_id);

-- Task Labels: Access through task ownership AND label ownership
CREATE POLICY "Users can view own task_labels" ON task_labels
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own task_labels" ON task_labels
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.user_id = auth.uid())
    AND
    EXISTS (SELECT 1 FROM labels WHERE labels.id = task_labels.label_id AND labels.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own task_labels" ON task_labels
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.user_id = auth.uid())
  );

-- Focus Logs: Users can only access their own logs
CREATE POLICY "Users can view own focus_logs" ON focus_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focus_logs" ON focus_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      task_id IS NULL 
      OR EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_id AND tasks.user_id = auth.uid())
    )
  );
CREATE POLICY "Users can update own focus_logs" ON focus_logs
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      task_id IS NULL 
      OR EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_id AND tasks.user_id = auth.uid())
    )
  );

-- Push Subscriptions: Users can only access their own subscriptions
CREATE POLICY "Users can view own push_subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push_subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own push_subscriptions" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own push_subscriptions" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Notification Queue: Users can only access their own
CREATE POLICY "Users can view own notification_queue" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification_queue" ON notification_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification_queue" ON notification_queue
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notification_queue" ON notification_queue
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 11. MIGRATION: 20260109_rls_hardening (Validation Constraints)
-- =============================================================================

-- 1. Projects Table Constraints
ALTER TABLE public.projects
  ADD CONSTRAINT projects_name_length_check CHECK (char_length(name) <= 50);

ALTER TABLE public.projects
  ADD CONSTRAINT projects_color_check CHECK (color ~* '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$');

-- 2. Tasks Table Constraints
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_content_length_check CHECK (char_length(content) <= 500);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_description_length_check CHECK (char_length(description) <= 5000);

-- =============================================================================
-- 12. HABITS & HABIT_ENTRIES
-- =============================================================================

-- A. Habits Table
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4B6CB7',
  icon TEXT,
  start_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  archived_at TIMESTAMPTZ,
  
  CONSTRAINT habits_name_length_check CHECK (char_length(name) <= 100),
  CONSTRAINT habits_description_length_check CHECK (char_length(description) <= 500)
);

-- Index for faster user-scoped lookups
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits (user_id);

-- Updated At Trigger
CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- B. Habit Entries Table
CREATE TABLE IF NOT EXISTS public.habit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(habit_id, date)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS habit_entries_habit_id_idx ON public.habit_entries (habit_id);

-- C. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habits" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habits" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own habit_entries" ON public.habit_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.habits WHERE public.habits.id = habit_entries.habit_id AND public.habits.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own habit_entries" ON public.habit_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.habits WHERE public.habits.id = habit_entries.habit_id AND public.habits.user_id = auth.uid())
  );
CREATE POLICY "Users can update own habit_entries" ON public.habit_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.habits WHERE public.habits.id = habit_entries.habit_id AND public.habits.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own habit_entries" ON public.habit_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.habits WHERE public.habits.id = habit_entries.habit_id AND public.habits.user_id = auth.uid())
  );


-- =============================================================================
-- 13. CALENDAR_EVENTS TABLE (Native & Synced Events)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core Event Fields (RFC 5545 compliant)
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  
  -- Categorization
  color TEXT DEFAULT '#4B6CB7',
  category TEXT,
  
  -- Recurrence (RRULE storage)
  recurrence_rule TEXT,
  
  -- Sync Metadata (for CalDAV/ICS sync)
  remote_id TEXT,
  remote_calendar_id UUID,
  etag TEXT,
  ics_uid TEXT,
  
  -- Soft Deletion (per D-48-06)
  is_archived BOOLEAN DEFAULT false,
  
  -- Flexible Metadata (per D-48-07 Hybrid Mapping)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT calendar_events_title_length_check CHECK (char_length(title) <= 200),
  CONSTRAINT calendar_events_description_length_check CHECK (char_length(description) <= 2000),
  CONSTRAINT calendar_events_end_after_start CHECK (end_time >= start_time)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx ON public.calendar_events (user_id);
CREATE INDEX IF NOT EXISTS calendar_events_start_time_idx ON public.calendar_events (start_time);
CREATE INDEX IF NOT EXISTS calendar_events_remote_id_idx ON public.calendar_events (remote_id) WHERE remote_id IS NOT NULL;

-- Updated At Trigger
CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ROW LEVEL SECURITY
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar_events" ON public.calendar_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar_events" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar_events" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar_events" ON public.calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 14. EXTERNAL_CALENDARS TABLE (Multi-Provider Sync Metadata)
-- =============================================================================
-- Supports: CalDAV (iCloud, Fastmail, Nextcloud), Google Calendar, Microsoft Outlook
-- Per D-48-08: All providers built, but Google/Outlook feature-flagged as Premium

CREATE TABLE IF NOT EXISTS public.external_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider Info (supports all adapter strategies from RESEARCH.md 3.2)
  provider TEXT NOT NULL CHECK (provider IN ('caldav', 'google', 'outlook', 'icloud', 'fastmail', 'nextcloud')),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4B6CB7',
  
  -- Connection Details (varies by provider)
  server_url TEXT, -- CalDAV server URL (null for Google/Outlook)
  calendar_url TEXT, -- Discovered calendar collection URL
  principal_url TEXT, -- CalDAV principal (null for Google/Outlook)
  
  -- Auth (encrypted at rest by Supabase)
  username TEXT, -- CalDAV username (null for Google/Outlook which use OAuth)
  -- Note: For CalDAV, passwords stored in Supabase Vault or user-provided on each sync
  -- For Google/Outlook: OAuth tokens managed by Supabase Auth provider tokens
  
  -- OAuth Provider Specifics (for Google/Outlook)
  oauth_provider_token_id TEXT, -- Reference to supabase auth.identities for OAuth refresh
  remote_calendar_id TEXT, -- Google Calendar ID or Outlook folder ID
  
  -- Sync State
  sync_token TEXT, -- CTag for CalDAV, nextSyncToken for Google, deltaLink for MS Graph
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,
  
  -- Settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'pull', 'push')),
  
  -- Feature Gating (per D-48-08)
  is_premium_provider BOOLEAN DEFAULT false, -- true for google/outlook
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT external_calendars_name_length CHECK (char_length(name) <= 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS external_calendars_user_id_idx ON public.external_calendars (user_id);
CREATE INDEX IF NOT EXISTS external_calendars_provider_idx ON public.external_calendars (provider);

-- Updated At Trigger
CREATE TRIGGER external_calendars_updated_at
  BEFORE UPDATE ON public.external_calendars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.external_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own external_calendars" ON public.external_calendars
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own external_calendars" ON public.external_calendars
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own external_calendars" ON public.external_calendars
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own external_calendars" ON public.external_calendars
  FOR DELETE USING (auth.uid() = user_id);

-- Add foreign key to calendar_events for remote_calendar_id
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_remote_calendar_fk
  FOREIGN KEY (remote_calendar_id) REFERENCES public.external_calendars(id) ON DELETE SET NULL;

-- =============================================================================
-- 15. USER_TIMER_STATE TABLE (Real-Time Focus Sync)
-- =============================================================================
-- One row per user. Upsert pattern (onConflict: user_id).
-- Sync fields: mode, remaining_seconds, is_running, active_task_id, updated_at.
-- No DELETE policy needed -- row persists for the user's lifetime.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_timer_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'focus' CHECK (mode IN ('focus', 'shortBreak', 'longBreak')),
  remaining_seconds INT NOT NULL DEFAULT 1500,
  is_running BOOLEAN NOT NULL DEFAULT false,
  active_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Unique index for one-row-per-user upsert
CREATE UNIQUE INDEX IF NOT EXISTS user_timer_state_user_id_idx ON public.user_timer_state (user_id);

-- Updated At Trigger
CREATE TRIGGER user_timer_state_updated_at
  BEFORE UPDATE ON public.user_timer_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ROW LEVEL SECURITY (enforce user_id = auth.uid())
ALTER TABLE public.user_timer_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timer state" ON public.user_timer_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own timer state" ON public.user_timer_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own timer state" ON public.user_timer_state
  FOR UPDATE USING (auth.uid() = user_id);

-- Add to realtime publication (required for postgres_changes events)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.user_timer_state;

