-- Ciphertext length exceeds plaintext limits. Event title/description stay
-- bounded client-side pre-encryption (CreateEventDialog's Zod schema); the
-- connected-calendar name is provider-supplied, never user-authored.
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_title_length_check;
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_description_length_check;
ALTER TABLE public.external_calendars DROP CONSTRAINT IF EXISTS external_calendars_name_length;
