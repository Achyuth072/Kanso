-- =============================================================================
-- USER TIMER STATE TABLE (Real-Time Focus Sync)
-- =============================================================================
-- One row per user. Upsert pattern (onConflict: user_id).
-- Sync fields: mode, remaining_seconds, is_running, active_task_id, updated_at.
-- No DELETE policy needed — row persists for the user's lifetime.
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_timer_state;
