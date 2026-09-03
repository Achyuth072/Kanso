-- =============================================================================
-- Notification payloads carry ciphertext, never readable content
-- =============================================================================
-- Both notification producers in the database interpolated tasks.content into
-- the queued payload, so the plaintext of a task survived in
-- notification_queue even once the tasks table itself was encrypted.
--
-- handle_task_notification_sync now stores the already-encrypted content
-- verbatim alongside a body template with a `{}` placeholder; the service
-- worker decrypts and substitutes at display time, and falls back to the
-- readable-content-free `body` when no key is available. The encrypted object
-- is attached only when the column actually holds a ciphertext envelope, so a
-- not-yet-encrypted row degrades to the generic body instead of leaking.
--
-- handle_timer_notification_sync reached into tasks for the text of a
-- timer_end body even though its own table is user_timer_state. It no longer
-- reads tasks at all: the body is generic, and the task is still identified by
-- data.taskId for the deep link.
-- =============================================================================

-- Returns encrypted payload envelope for valid ciphertext, or NULL to omit via jsonb_strip_nulls.
CREATE OR REPLACE FUNCTION public.encrypted_notification_body(
  template TEXT,
  ciphertext TEXT
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN ciphertext LIKE 'xchacha20poly1305-v1:%'
    THEN jsonb_build_object('template', template, 'ciphertext', ciphertext)
  END;
$$;

CREATE OR REPLACE FUNCTION handle_task_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
BEGIN
  -- Cancel only task-owned due/do notifications; leave timer_end rows and past-due rows (#155) untouched.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE reference_id = OLD.id
      AND status = 'pending'
      AND type IN ('due_date', 'do_date')
      AND scheduled_at > now();
  END IF;

  IF (TG_OP IN ('INSERT', 'UPDATE')) AND (NEW.is_completed = FALSE) THEN
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'due_date_alerts')::boolean IS NOT FALSE
       AND NEW.due_date IS NOT NULL AND NEW.due_date > now() THEN
      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.due_date, 'due_date',
              jsonb_strip_nulls(jsonb_build_object(
                'title', 'Task Due Soon',
                'body', 'You have a task due now.',
                'encrypted', public.encrypted_notification_body(
                  'Your task "{}" is due now.', NEW.content),
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              )),
              NEW.id);
    END IF;

    IF (user_settings->'notifications'->>'do_date_alerts')::boolean IS NOT FALSE
       AND NEW.do_date IS NOT NULL AND NEW.do_date > now() THEN
      INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
      VALUES (NEW.user_id, NEW.do_date, 'do_date',
              jsonb_strip_nulls(jsonb_build_object(
                'title', 'Time to focus',
                'body', 'You have a task scheduled now.',
                'encrypted', public.encrypted_notification_body(
                  'Scheduled: {}', NEW.content),
                'data', jsonb_build_object('url', '/', 'taskId', NEW.id)
              )),
              NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_timer_notification_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_settings JSONB;
  timer_settings JSONB;
  session_threshold INT;
  auto_start_break BOOLEAN;
  auto_start_focus BOOLEAN;
  cur_mode TEXT := NEW.mode;
  cur_ends_at TIMESTAMPTZ := NEW.ends_at;
  cur_completed_sessions INT := NEW.completed_sessions;
  next_mode TEXT;
  next_running BOOLEAN;
  next_completed_sessions INT;
  next_duration_minutes NUMERIC;
  payload_title TEXT;
  payload_body TEXT;
  depth INT := 0;
  MAX_CHAIN_DEPTH CONSTANT INT := 5;
BEGIN
  -- Skip entirely when nothing chain-relevant changed (e.g. a reconcile write
  -- that re-persists remaining_seconds/source_device_id on an already-running,
  -- already-projected timer) — otherwise every such write would cancel and
  -- rebuild an identical chain for no reason.
  IF TG_OP = 'UPDATE'
    AND NEW.is_running IS NOT DISTINCT FROM OLD.is_running
    AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
    AND NEW.mode IS NOT DISTINCT FROM OLD.mode
    AND NEW.completed_sessions IS NOT DISTINCT FROM OLD.completed_sessions
    AND NEW.active_task_id IS NOT DISTINCT FROM OLD.active_task_id
    AND NEW.settings IS NOT DISTINCT FROM OLD.settings
  THEN
    RETURN NEW;
  END IF;

  -- Phase 1 (cleanup): unconditionally cancel every still-pending timer_end
  -- row for this user. Safe because Phase 2 immediately rebuilds whatever
  -- chain is still needed, and there is exactly one user_timer_state row per
  -- user (enforced by user_timer_state_user_id_idx), so this is scoped
  -- correctly by construction — no device-local ref required.
  UPDATE public.notification_queue
  SET status = 'cancelled'
  WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND type = 'timer_end';

  -- Phase 2 (create): only project a chain for a running timer with a known
  -- deadline, and only if the user has timer alerts enabled.
  IF NEW.is_running AND NEW.ends_at IS NOT NULL THEN
    SELECT settings INTO user_settings FROM profiles WHERE id = NEW.user_id;

    IF (user_settings->'notifications'->>'timer_alerts')::boolean IS NOT FALSE THEN
      timer_settings := NEW.settings;
      session_threshold := COALESCE((timer_settings->>'sessionsBeforeLongBreak')::int, 4);
      auto_start_break := COALESCE((timer_settings->>'autoStartBreak')::boolean, false);
      auto_start_focus := COALESCE((timer_settings->>'autoStartFocus')::boolean, false);

      -- Replays timerStore's completeTimer() state machine: a focus interval
      -- advances to shortBreak/longBreak depending on the post-increment
      -- session count vs. the threshold; a break interval always advances
      -- back to focus and resets the counter only after a long break. Each
      -- subsequent interval is appended only while the relevant auto-start
      -- flag is true — the chain terminates the first time it isn't, capped
      -- at MAX_CHAIN_DEPTH regardless of settings as a safety net.
      WHILE depth < MAX_CHAIN_DEPTH LOOP
        depth := depth + 1;

        payload_title := CASE WHEN cur_mode = 'focus' THEN 'Focus Complete' ELSE 'Break Complete' END;
        payload_body := CASE
          WHEN cur_mode = 'focus' THEN 'Your focus session is complete. Take a break!'
          ELSE 'Your break is over. Time to focus!'
        END;

        -- reference_id stays NULL: timer_end rows are owned by the timer, not
        -- a task — a task-scoped reference_id would let task cleanup cancel a
        -- running timer's notification.
        INSERT INTO public.notification_queue (user_id, scheduled_at, type, payload, reference_id)
        VALUES (
          NEW.user_id,
          cur_ends_at,
          'timer_end',
          jsonb_build_object(
            'title', payload_title,
            'body', payload_body,
            'data', jsonb_build_object('url', '/focus', 'taskId', NEW.active_task_id)
          ),
          NULL
        );

        IF cur_mode = 'focus' THEN
          next_completed_sessions := cur_completed_sessions + 1;
          next_mode := CASE
            WHEN next_completed_sessions >= session_threshold THEN 'longBreak'
            ELSE 'shortBreak'
          END;
          next_running := auto_start_break;
        ELSE
          next_mode := 'focus';
          next_running := auto_start_focus;
          next_completed_sessions := CASE
            WHEN cur_mode = 'longBreak' THEN 0
            ELSE cur_completed_sessions
          END;
        END IF;

        EXIT WHEN NOT next_running;

        next_duration_minutes := CASE next_mode
          WHEN 'focus' THEN COALESCE((timer_settings->>'focusDuration')::numeric, 25)
          WHEN 'shortBreak' THEN COALESCE((timer_settings->>'shortBreakDuration')::numeric, 5)
          WHEN 'longBreak' THEN COALESCE((timer_settings->>'longBreakDuration')::numeric, 15)
        END;

        cur_ends_at := cur_ends_at + (next_duration_minutes * interval '1 minute');
        cur_mode := next_mode;
        cur_completed_sessions := next_completed_sessions;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
