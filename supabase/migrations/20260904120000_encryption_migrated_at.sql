ALTER TABLE public.encryption_keys ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;
