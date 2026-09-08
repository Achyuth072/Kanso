-- Ciphertext length exceeds plaintext limits; validated client-side pre-encryption.
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_name_length_check;
ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_name_length_check;
ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_description_length_check;
