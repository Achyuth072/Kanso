-- Ciphertext length exceeds plaintext limits; task content and description
-- stay bounded client-side pre-encryption (the task Zod schema's 500/5000).
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_content_length_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_description_length_check;
