ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

UPDATE public.push_subscriptions
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL OR endpoint = '';

DELETE FROM public.push_subscriptions
WHERE endpoint IS NULL OR endpoint = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.push_subscriptions
      DROP CONSTRAINT push_subscriptions_user_id_key;
  END IF;
END $$;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, endpoint
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.push_subscriptions
)
DELETE FROM public.push_subscriptions
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_key
  ON public.push_subscriptions(user_id, endpoint);
