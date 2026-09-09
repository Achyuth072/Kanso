-- Deduplicate pre-existing ics_uid rows (keeping earliest) so the unique index can build.
-- Note: Without RECURRENCE-ID support, modified occurrences sharing a UID are collapsed.
DELETE FROM public.calendar_events
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, ics_uid
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.calendar_events
    WHERE ics_uid IS NOT NULL
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_user_ics_uid_key
  ON public.calendar_events (user_id, ics_uid)
  WHERE ics_uid IS NOT NULL;
