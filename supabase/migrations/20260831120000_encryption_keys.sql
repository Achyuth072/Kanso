-- =============================================================================
-- ENCRYPTION_KEYS TABLE
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
