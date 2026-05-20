/**
 * Focus Session Types
 */

export interface FocusLog {
  id: string;
  user_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  created_at: string;
}
