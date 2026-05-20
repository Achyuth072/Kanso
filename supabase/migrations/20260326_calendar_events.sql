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
