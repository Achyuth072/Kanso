DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop any unique constraint that is only on user_id
    FOR r IN
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'push_subscriptions'
          AND tc.constraint_type = 'UNIQUE'
          AND (
            SELECT COUNT(*) 
            FROM information_schema.key_column_usage 
            WHERE constraint_name = tc.constraint_name
          ) = 1
          AND kcu.column_name = 'user_id'
    LOOP
        EXECUTE 'ALTER TABLE public.push_subscriptions DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
    
    -- 2. Drop any unique index that is only on user_id
    FOR r IN
        SELECT i.relname AS index_name
        FROM pg_class t
        JOIN pg_index ix ON ix.indrelid = t.oid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = 'push_subscriptions' AND ix.indisunique = true AND t.relnamespace = 'public'::regnamespace
          AND a.attname = 'user_id' AND ix.indnatts = 1
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.index_name);
    END LOOP;
END $$;

-- 3. Replace the unique index with a concrete UNIQUE CONSTRAINT (required for PostgREST UPSERT)
DROP INDEX IF EXISTS public.push_subscriptions_user_endpoint_key;

ALTER TABLE public.push_subscriptions 
  ADD CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint);

-- 4. Force PostgREST schema cache to reload so the new endpoint column is visible to the API
NOTIFY pgrst, 'reload schema';
