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
  is_admin BOOLEAN DEFAULT false NOT NULL,
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

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks (user_id);

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

-- Leftmost prefix also covers user_id-only lookups.
CREATE INDEX IF NOT EXISTS focus_logs_user_id_start_time_idx
  ON public.focus_logs (user_id, start_time);

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
  -- 'processing' = claimed by a sender run, not yet resolved.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ,
  -- Scrubbed plaintext (ADR 0016); must not store raw error payloads.
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  -- Backoff time for a retry; scheduled_at stays immutable as "when this was
  -- meant to fire".
  next_attempt_at TIMESTAMPTZ
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS notification_queue_claim_idx ON public.notification_queue (COALESCE(next_attempt_at, scheduled_at)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_queue_user_id_idx ON public.notification_queue (user_id);

-- =============================================================================
-- 8. TRIGGERS: Auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name',
      NEW.email
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default Inbox project (only if not exists)
  INSERT INTO public.projects (user_id, name, is_inbox)
  SELECT NEW.id, 'Inbox', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.projects WHERE user_id = NEW.id AND is_inbox = true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- handle_new_user runs only as an AFTER INSERT trigger on auth.users; trigger
-- firing does not check EXECUTE, so drop the implicit PUBLIC grant that would
-- otherwise expose it on /rest/v1/rpc/*.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;

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
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.timezone
  FROM public.profiles p
  WHERE
    -- Is it 8 AM in their timezone?
    (now() AT TIME ZONE p.timezone)::time >= '08:00:00'
    AND (now() AT TIME ZONE p.timezone)::time < '09:00:00'
    -- Haven't received a briefing in the last 20 hours
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue n
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
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.timezone
  FROM public.profiles p
  WHERE
    -- Is it 6 PM in their timezone? (18:00)
    (now() AT TIME ZONE p.timezone)::time >= '18:00:00'
    AND (now() AT TIME ZONE p.timezone)::time < '19:00:00'
    -- Haven't received an evening plan in the last 20 hours
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue n
      WHERE n.user_id = p.id
      AND n.type = 'evening'
      AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

-- Briefing helpers are called only by the daily-briefing edge function as
-- service_role; drop the implicit PUBLIC grant so anon/authenticated can't
-- reach them over /rest/v1/rpc/*.
REVOKE EXECUTE ON FUNCTION get_users_for_morning_briefing() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_users_for_evening_plan()     FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_users_for_morning_briefing() TO service_role;
GRANT EXECUTE ON FUNCTION get_users_for_evening_plan()     TO service_role;

-- B2. Queue Claim Helper
-- SKIP LOCKED lets concurrent process-queue runs take disjoint batches instead
-- of racing for the same rows. Rows stuck in 'processing' (sender crashed
-- mid-flight) become claimable again after 30 seconds — kept under timer_end's
-- 60s TTL so a reclaimed row still has retry budget left.
CREATE OR REPLACE FUNCTION public.claim_due_notifications(p_limit INT DEFAULT 50)
RETURNS SETOF public.notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A row reclaimed this many times is abandoned rather than reclaimed
  -- forever. 3 mirrors MAX_RETRIES in _shared/push-delivery.ts.
  UPDATE public.notification_queue
  SET status = 'failed',
      error_message = 'abandoned after repeated incomplete delivery attempts'
  WHERE status = 'processing'
    AND claimed_at < now() - interval '30 seconds'
    AND retry_count >= 3;

  RETURN QUERY
  UPDATE public.notification_queue q
  SET status = 'processing',
      claimed_at = now(),
      -- SET expressions see the pre-UPDATE row, so this reads the old status.
      retry_count = CASE
        WHEN q.status = 'processing' THEN q.retry_count + 1
        ELSE q.retry_count
      END
  WHERE q.id IN (
    SELECT c.id
    FROM public.notification_queue c
    WHERE (c.status = 'pending'
           AND COALESCE(c.next_attempt_at, c.scheduled_at) <= now())
       OR (c.status = 'processing' AND c.claimed_at < now() - interval '30 seconds')
    ORDER BY c.scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING q.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_due_notifications(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(INT) TO service_role;

-- B3. Scheduler
-- Declared here rather than left to the dashboard, so the cron job is
-- reviewable and restorable from backup rather than failing silently.
--
-- Credentials come from Vault, never from this file. Set them once per project:
--     select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--     select vault.create_secret('<service-role-key>', 'service_role_key');

CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_function TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Raise rather than silently no-op: surfaces in cron.job_run_details.return_message.
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION
      'invoke_edge_function(%): vault secrets project_url and/or service_role_key are not set',
      p_function;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(TEXT) FROM PUBLIC;

-- Unschedule first so a re-run of this file doesn't error on a duplicate
-- jobname. Overlapping process-queue runs are safe: claim_due_notifications
-- takes rows with FOR UPDATE SKIP LOCKED.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('process-notification-queue', 'system-daily-briefing');

SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$SELECT public.invoke_edge_function('process-queue')$$
);

SELECT cron.schedule(
  'system-daily-briefing',
  '0 * * * *',
  $$SELECT public.invoke_edge_function('daily-briefing')$$
);

-- Returns encrypted payload envelope for valid ciphertext, or NULL to omit via jsonb_strip_nulls.
CREATE OR REPLACE FUNCTION public.encrypted_notification_body(
  template TEXT,
  ciphertext TEXT
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN ciphertext LIKE 'xchacha20poly1305-v1:%'
    THEN jsonb_build_object('template', template, 'ciphertext', ciphertext)
  END;
$$;

CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
BEGIN
  -- Cancel only task-owned due/do notifications; leave timer_end rows and past-due rows (#155) untouched.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending'
      AND type IN ('due_date', 'do_date')
      AND scheduled_at > now();
  END IF;

  IF (TG_OP IN ('INSERT', 'UPDATE')) AND (NEW.is_completed = FALSE) THEN
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'due_date_alerts')::boolean IS NOT FALSE 
       AND NEW.due_date IS NOT NULL AND NEW.due_date > now() THEN
      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.due_date, 'due_date',
              jsonb_strip_nulls(jsonb_build_object(
                'title', 'Task Due Soon',
                'body', 'You have a task due now.',
                'encrypted', public.encrypted_notification_body(
                  'Your task "{}" is due now.', NEW.content),
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              )),
              NEW.id);
    END IF;

    IF (user_settings->'notifications'->>'do_date_alerts')::boolean IS NOT FALSE 
       AND NEW.do_date IS NOT NULL AND NEW.do_date > now() THEN
      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.do_date, 'do_date',
              jsonb_strip_nulls(jsonb_build_object(
                'title', 'Time to focus',
                'body', 'You have a task scheduled now.',
                'encrypted', public.encrypted_notification_body(
                  'Scheduled: {}', NEW.content),
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              )),
              NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

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
-- The policy above has no column restriction — without this, any
-- authenticated user could self-grant admin via
-- supabase.from('profiles').update({ is_admin: true }).
--
-- Column-level REVOKE cannot subtract from Supabase's default table-level
-- GRANT ALL; drop table-level UPDATE and re-grant only user-editable columns.
-- Any column added to profiles later is non-writable by default (fail closed).
REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (display_name, settings, timezone) ON profiles TO authenticated;

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

-- Projects Table Constraints
ALTER TABLE public.projects
  ADD CONSTRAINT projects_color_check CHECK (color ~* '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$');

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
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  archived_at TIMESTAMPTZ,
  -- Links to its raw record in habit_imports for round-trip export (ADR 0006).
  source_uuid TEXT
);

-- Index for faster user-scoped lookups
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits (user_id);

-- Index for user-scoped ordered fetches (compact/grid views sort by sort_order)
CREATE INDEX IF NOT EXISTS habits_user_sort_idx ON public.habits (user_id, sort_order);

-- Updated At Trigger
CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Atomic reorder: one transactional UPDATE for all rows so a partial failure
-- can't leave a half-reordered set. SECURITY INVOKER keeps RLS scoping in force.
CREATE OR REPLACE FUNCTION public.reorder_habits(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.habits AS h
  SET sort_order = (u.value ->> 'sort_order')::int
  FROM jsonb_array_elements(updates) AS u
  WHERE h.id = (u.value ->> 'id')::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_habits(jsonb) TO authenticated;

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

-- D. Habit Imports: raw provenance for round-trip export, write-once/immutable (ADR 0006)
CREATE TABLE IF NOT EXISTS public.habit_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_app TEXT NOT NULL DEFAULT 'uhabits',
  -- Client-encrypted (ADR 0016). raw holds JSON ciphertext; do not use JSONB operators.
  file_name TEXT,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS habit_imports_user_id_idx ON public.habit_imports (user_id);

ALTER TABLE public.habit_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habit_imports" ON public.habit_imports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habit_imports" ON public.habit_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own habit_imports" ON public.habit_imports
  FOR DELETE USING (auth.uid() = user_id);


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
  -- Scrubbed plaintext (ADR 0016); see notification_queue.error_message.
  sync_error TEXT,

  -- Settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'pull', 'push')),
  
  -- Feature Gating (per D-48-08)
  is_premium_provider BOOLEAN DEFAULT false, -- true for google/outlook
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
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
  -- ends_at: server-epoch deadline while running (null when paused/idle).
  -- source_device_id: device that last explicitly wrote the running state
  -- (ownership/echo marker). completed_sessions: synced cycle counter.
  -- settings: per-account focus settings (duration, auto-start, sessions-
  -- before-long-break) so every device agrees on durations and progress.
  ends_at TIMESTAMPTZ,
  source_device_id TEXT,
  completed_sessions INT NOT NULL DEFAULT 0,
  settings JSONB,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Unique index for one-row-per-user upsert
CREATE UNIQUE INDEX IF NOT EXISTS user_timer_state_user_id_idx ON public.user_timer_state (user_id);

-- Updated At Trigger
CREATE TRIGGER user_timer_state_updated_at
  BEFORE UPDATE ON public.user_timer_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Full row in the WAL so Realtime (filtered on user_id, not the PK) and RLS
-- can evaluate the update for cross-device delivery. See ADR 0002.
ALTER TABLE public.user_timer_state REPLICA IDENTITY FULL;

-- ROW LEVEL SECURITY (enforce user_id = auth.uid())
ALTER TABLE public.user_timer_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timer state" ON public.user_timer_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own timer state" ON public.user_timer_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own timer state" ON public.user_timer_state
  FOR UPDATE USING (auth.uid() = user_id);

-- Add to realtime publication (required for postgres_changes events)
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_timer_state;

-- =============================================================================
-- 16. TIMER NOTIFICATION CHAIN TRIGGER (server-derived timer_end scheduling)
-- =============================================================================
-- Notification *scheduling* is server-derived: this trigger projects the
-- chain of upcoming timer_end deadlines directly from user_timer_state's own
-- row, atomically re-projected on every write. Follows the same two-phase
-- (cleanup, then create) structure as handle_task_notification_sync.
-- Completion semantics (which device logs/advances a finished session, the
-- race-free WHERE ends_at = <deadline> claim) are unchanged — see ADR 0002.
-- =============================================================================

-- One row per (user, type, deadline) while pending.
CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_pending_dedup_idx
  ON public.notification_queue (user_id, type, scheduled_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION handle_timer_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
  timer_settings JSONB;
  session_threshold INT;
  auto_start_break BOOLEAN;
  auto_start_focus BOOLEAN;
  cur_mode TEXT := NEW.mode;
  cur_ends_at TIMESTAMPTZ := NEW.ends_at;
  cur_completed_sessions INT := NEW.completed_sessions;
  next_mode TEXT;
  next_running BOOLEAN;
  next_completed_sessions INT;
  next_duration_minutes NUMERIC;
  payload_title TEXT;
  payload_body TEXT;
  depth INT := 0;
  MAX_CHAIN_DEPTH CONSTANT INT := 5;
BEGIN
  -- Skip entirely when nothing chain-relevant changed (e.g. a reconcile write
  -- that re-persists remaining_seconds/source_device_id on an already-running,
  -- already-projected timer) — otherwise every such write would cancel and
  -- rebuild an identical chain for no reason.
  IF TG_OP = 'UPDATE'
    AND NEW.is_running IS NOT DISTINCT FROM OLD.is_running
    AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
    AND NEW.mode IS NOT DISTINCT FROM OLD.mode
    AND NEW.completed_sessions IS NOT DISTINCT FROM OLD.completed_sessions
    AND NEW.active_task_id IS NOT DISTINCT FROM OLD.active_task_id
    AND NEW.settings IS NOT DISTINCT FROM OLD.settings
  THEN
    RETURN NEW;
  END IF;

  -- Phase 1 (cleanup): unconditionally cancel every still-pending timer_end
  -- row for this user. Safe because Phase 2 immediately rebuilds whatever
  -- chain is still needed, and there is exactly one user_timer_state row per
  -- user (enforced by user_timer_state_user_id_idx), so this is scoped
  -- correctly by construction — no device-local ref required.
  UPDATE public.notification_queue
  SET status = 'cancelled'
  WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND type = 'timer_end';

  -- Phase 2 (create): only project a chain for a running timer with a known
  -- deadline, and only if the user has timer alerts enabled.
  IF NEW.is_running AND NEW.ends_at IS NOT NULL THEN
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'timer_alerts')::boolean IS NOT FALSE THEN
      timer_settings := NEW.settings;
      session_threshold := COALESCE((timer_settings->>'sessionsBeforeLongBreak')::int, 4);
      auto_start_break := COALESCE((timer_settings->>'autoStartBreak')::boolean, false);
      auto_start_focus := COALESCE((timer_settings->>'autoStartFocus')::boolean, false);

      -- Replays timerStore's completeTimer() state machine: a focus interval
      -- advances to shortBreak/longBreak depending on the post-increment
      -- session count vs. the threshold; a break interval always advances
      -- back to focus and resets the counter only after a long break. Each
      -- subsequent interval is appended only while the relevant auto-start
      -- flag is true — the chain terminates the first time it isn't, capped
      -- at MAX_CHAIN_DEPTH regardless of settings as a safety net.
      WHILE depth < MAX_CHAIN_DEPTH LOOP
        depth := depth + 1;

        payload_title := CASE WHEN cur_mode = 'focus' THEN 'Focus Complete' ELSE 'Break Complete' END;
        payload_body := CASE
          WHEN cur_mode = 'focus' THEN 'Your focus session is complete. Take a break!'
          ELSE 'Your break is over. Time to focus!'
        END;

        -- reference_id stays NULL: timer_end rows are owned by the timer, not
        -- a task — a task-scoped reference_id would let task cleanup cancel a
        -- running timer's notification.
        INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
        VALUES (
          NEW.user_id,
          cur_ends_at,
          'timer_end',
          jsonb_build_object(
            'title', payload_title,
            'body', payload_body,
            'data', jsonb_build_object('url', '/focus', 'taskId', NEW.active_task_id)
          ),
          NULL
        );

        IF cur_mode = 'focus' THEN
          next_completed_sessions := cur_completed_sessions + 1;
          next_mode := CASE
            WHEN next_completed_sessions >= session_threshold THEN 'longBreak'
            ELSE 'shortBreak'
          END;
          next_running := auto_start_break;
        ELSE
          next_mode := 'focus';
          next_running := auto_start_focus;
          next_completed_sessions := CASE
            WHEN cur_mode = 'longBreak' THEN 0
            ELSE cur_completed_sessions
          END;
        END IF;

        EXIT WHEN NOT next_running;

        next_duration_minutes := CASE next_mode
          WHEN 'focus' THEN COALESCE((timer_settings->>'focusDuration')::numeric, 25)
          WHEN 'shortBreak' THEN COALESCE((timer_settings->>'shortBreakDuration')::numeric, 5)
          WHEN 'longBreak' THEN COALESCE((timer_settings->>'longBreakDuration')::numeric, 15)
        END;

        cur_ends_at := cur_ends_at + (next_duration_minutes * interval '1 minute');
        cur_mode := next_mode;
        cur_completed_sessions := next_completed_sessions;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- No DELETE: unlike tasks, a user_timer_state row is never deleted (one row
-- per user for the account's lifetime — see its own table comment).
DROP TRIGGER IF EXISTS sync_timer_notifications ON public.user_timer_state;
CREATE TRIGGER sync_timer_notifications
AFTER INSERT OR UPDATE ON public.user_timer_state
FOR EACH ROW EXECUTE FUNCTION handle_timer_notification_sync();

-- =============================================================================
-- 17. WAITLIST_SIGNUPS TABLE (Founding-Tester Cohort)
-- =============================================================================
-- Moved here from kagelin-web's supabase/waitlist_signups.sql (deleted there
-- as of this change): it lives in this Postgres instance, so it belongs in
-- this migration stream. Written only via kagelin-web's server-side
-- /api/waitlist route (secret key, bypasses RLS) and read/updated by the
-- founding-grant tooling in kagelin-web (see CONTEXT.md "Founding cohort" /
-- "Invited" / "Founding grant").
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL,
  cohort              TEXT NOT NULL DEFAULT 'founding'
                      CHECK (cohort IN ('founding', 'general')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Operator emailed this signup the offer. Confers no entitlement — see
  -- handle_email_confirmed() for the actual grant condition.
  invited_at          TIMESTAMPTZ,
  -- Stamped by handle_email_confirmed() when a founding-cohort signup
  -- confirms their app account email. Provenance only: it does not compute
  -- when the founding discount starts, which is a single operator-declared
  -- event (end of beta), not a per-user duration.
  premium_granted_at  TIMESTAMPTZ
);

-- The /api/waitlist route relies on 23505 (unique_violation) to detect
-- "already signed up".
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_key
  ON public.waitlist_signups (email);

-- Deny-by-default: RLS on with no policies, and revoke API-role grants.
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_signups FROM anon, authenticated;
GRANT ALL ON public.waitlist_signups TO supabase_auth_admin;

-- =============================================================================
-- 18. TRIGGER: Grant Founding Premium on Email Confirmation
-- =============================================================================
-- Deliberately NOT part of handle_new_user() (AFTER INSERT ON auth.users).
-- This app's magic-link flow is PKCE: signInWithOtp() creates the auth.users
-- row — unconfirmed — before the email is ever proven owned; confirmation
-- happens later, as an UPDATE, when the emailed link is followed
-- (app/auth/callback exchanges the code). Keying the grant off INSERT would
-- let anyone request a magic link for a founding-cohort member's address and
-- stamp their grant without ever proving they own that inbox.
CREATE OR REPLACE FUNCTION handle_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Founding grant: membership in the founding cohort earns Premium the
  -- moment the person confirms they own the app account's email —
  -- independent of invite order. Stamp public.profiles first and only mark
  -- waitlist_signups.premium_granted_at once that UPDATE actually found a
  -- row: premium_granted_at is provenance, not just an idempotency flag, so
  -- it must not go non-NULL for a grant that didn't land (e.g. if the
  -- profiles row doesn't exist yet because on_auth_user_created hasn't run —
  -- see the trigger-ordering note below). The WHERE below is still what
  -- prevents re-granting on a second call.
  UPDATE public.profiles
  SET is_premium = true
  WHERE id = NEW.id
    AND EXISTS (
      SELECT 1 FROM public.waitlist_signups
      WHERE email = NEW.email
        AND cohort = 'founding'
        AND premium_granted_at IS NULL
    );

  IF FOUND THEN
    UPDATE public.waitlist_signups
    SET premium_granted_at = now()
    WHERE email = NEW.email
      AND cohort = 'founding'
      AND premium_granted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION handle_email_confirmed() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_email_confirmed();

-- The UPDATE trigger above only covers rows confirmed *after* creation. OAuth
-- providers vouch for the email themselves, so Supabase stamps
-- email_confirmed_at at INSERT and that transition never happens — without
-- this second trigger an OAuth signup would silently never be granted. Added
-- ahead of any OAuth provider existing, so the migration isn't revisited.
--
-- Name matters: triggers on the same event fire in alphabetical order, and
-- on_auth_user_created (which inserts the profiles row) must run first or the
-- is_premium UPDATE in handle_email_confirmed() above finds nothing.
--
-- This makes Supabase's "Confirm email" setting load-bearing: turn it off and
-- password signups also arrive confirmed, letting anyone claim a founding
-- member's grant by typing their address. Keep it on.
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_insert ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_email_confirmed();

-- The one-time backfill for pre-existing confirmed accounts lives only in
-- the migration (20260811150000_founding_grant_waitlist.sql) — this file is
-- the declarative shape of the DB, not a place for one-shot DML that would
-- otherwise re-run on every rebuild.

-- =============================================================================
-- 19. RPC: has_password()
-- =============================================================================
-- identities has no signal for this: both password sign-up and magic-link/OTP
-- create an `email` identity, so client code can't tell the two apart by
-- checking for one. The password hash lives on auth.users and is never sent
-- to the client, so this reads it server-side and returns only a boolean for
-- the calling user.
CREATE OR REPLACE FUNCTION public.has_password()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT encrypted_password IS NOT NULL AND encrypted_password <> ''
  FROM auth.users
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.has_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_password() TO authenticated;

-- =============================================================================
-- 20. TELEMETRY: Events, Daily Aggregates, and Retention Pruning
-- =============================================================================

-- 1. Raw Telemetry Event Buffer (30-day TTL)
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast time-window and event aggregations
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at
  ON public.telemetry_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_created
  ON public.telemetry_events (event_name, created_at DESC);

-- Enable RLS: No public read access; insert only via service role (API route)
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telemetry_events FROM anon, authenticated;

-- 2. Permanent Daily Aggregates
CREATE TABLE IF NOT EXISTS public.telemetry_daily_aggregates (
  date DATE PRIMARY KEY,
  active_devices INT NOT NULL DEFAULT 0,
  pwa_devices INT NOT NULL DEFAULT 0,
  browser_devices INT NOT NULL DEFAULT 0,
  pwa_installs INT NOT NULL DEFAULT 0,
  tasks_created INT NOT NULL DEFAULT 0,
  tasks_completed INT NOT NULL DEFAULT 0,
  timer_sessions_completed INT NOT NULL DEFAULT 0,
  timer_sessions_abandoned INT NOT NULL DEFAULT 0,
  focus_minutes_total INT NOT NULL DEFAULT 0,
  habits_logged INT NOT NULL DEFAULT 0,
  signups_completed INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telemetry_daily_aggregates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telemetry_daily_aggregates FROM anon, authenticated;

-- 3. Automated Retention Cleanup Function (Purges raw events > 30 days)
CREATE OR REPLACE FUNCTION public.prune_stale_telemetry_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.telemetry_events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_stale_telemetry_events() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_stale_telemetry_events() FROM anon, authenticated;

-- 4. Nightly Rollup: writes yesterday's raw events into the permanent
-- daily_aggregates row the admin dashboard reads.
CREATE OR REPLACE FUNCTION public.aggregate_daily_telemetry(
  target_date DATE DEFAULT (CURRENT_DATE - INTERVAL '1 day')::DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  day_start TIMESTAMPTZ := (target_date::text || ' 00:00:00+00')::timestamptz;
  day_end TIMESTAMPTZ := day_start + INTERVAL '1 day';
BEGIN
  -- Bounds are explicit UTC timestamptz literals (not a `created_at::date`
  -- cast) so the query can use idx_telemetry_events_created_at as a range
  -- scan and stays correct regardless of the session timezone.
  INSERT INTO public.telemetry_daily_aggregates (
    date, active_devices, pwa_devices, browser_devices, pwa_installs,
    tasks_created, tasks_completed, timer_sessions_completed,
    timer_sessions_abandoned, focus_minutes_total, habits_logged,
    signups_completed, updated_at
  )
  SELECT
    target_date,
    COUNT(DISTINCT device_id),
    COUNT(DISTINCT device_id) FILTER (
      WHERE event_name = 'app_opened' AND properties->>'display_mode' = 'standalone'
    ),
    COUNT(DISTINCT device_id) FILTER (
      WHERE event_name = 'app_opened' AND properties->>'display_mode' = 'browser'
    ),
    COUNT(*) FILTER (WHERE event_name = 'pwa_installed'),
    COUNT(*) FILTER (WHERE event_name = 'task_action' AND properties->>'action' = 'created'),
    COUNT(*) FILTER (WHERE event_name = 'task_action' AND properties->>'action' = 'completed'),
    COUNT(*) FILTER (WHERE event_name = 'focus_session' AND properties->>'status' = 'completed'),
    COUNT(*) FILTER (WHERE event_name = 'focus_session' AND properties->>'status' = 'abandoned'),
    COALESCE(
      SUM((properties->>'duration_minutes')::numeric) FILTER (
        WHERE event_name = 'focus_session' AND properties->>'status' = 'completed'
      ),
      0
    )::int,
    COUNT(*) FILTER (WHERE event_name = 'habit_logged'),
    COUNT(*) FILTER (WHERE event_name = 'signup_completed'),
    now()
  FROM public.telemetry_events
  WHERE created_at >= day_start AND created_at < day_end
  ON CONFLICT (date) DO UPDATE SET
    active_devices = EXCLUDED.active_devices,
    pwa_devices = EXCLUDED.pwa_devices,
    browser_devices = EXCLUDED.browser_devices,
    pwa_installs = EXCLUDED.pwa_installs,
    tasks_created = EXCLUDED.tasks_created,
    tasks_completed = EXCLUDED.tasks_completed,
    timer_sessions_completed = EXCLUDED.timer_sessions_completed,
    timer_sessions_abandoned = EXCLUDED.timer_sessions_abandoned,
    focus_minutes_total = EXCLUDED.focus_minutes_total,
    habits_logged = EXCLUDED.habits_logged,
    signups_completed = EXCLUDED.signups_completed,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aggregate_daily_telemetry(DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aggregate_daily_telemetry(DATE) FROM anon, authenticated;

-- Unschedule first so a re-run of this file doesn't error on a duplicate jobname.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('telemetry-daily-rollup', 'telemetry-prune-stale-events');

-- 00:05 UTC: roll up yesterday's raw events into the permanent daily row.
SELECT cron.schedule(
  'telemetry-daily-rollup',
  '5 0 * * *',
  $$SELECT public.aggregate_daily_telemetry()$$
);

-- 00:15 UTC: prune raw events past the 30-day TTL, after the rollup has read them.
SELECT cron.schedule(
  'telemetry-prune-stale-events',
  '15 0 * * *',
  $$SELECT public.prune_stale_telemetry_events()$$
);

-- pg_cron logs every job run to cron.job_run_details and never prunes it
-- itself (see pg_cron's own docs) — schedule a daily cleanup so it doesn't
-- grow unbounded alongside the telemetry retention jobs above.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'cron-prune-job-run-details';

SELECT cron.schedule(
  'cron-prune-job-run-details',
  '30 0 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);

-- =============================================================================
-- 21. ENCRYPTION_KEYS TABLE (Content Encryption Master Key)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  passphrase_salt TEXT NOT NULL,
  passphrase_kdf_params JSONB NOT NULL,
  wrapped_key_passphrase TEXT NOT NULL,
  recovery_salt TEXT NOT NULL,
  recovery_kdf_params JSONB NOT NULL,
  wrapped_key_recovery TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encryption_keys" ON public.encryption_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own encryption_keys" ON public.encryption_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own encryption_keys" ON public.encryption_keys
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER encryption_keys_updated_at
  BEFORE UPDATE ON public.encryption_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


