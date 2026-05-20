export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  start_date: string;
}

export interface HabitEntry {
  id: string;
  habit_id: string;
  date: string; // ISO 8601 date (YYYY-MM-DD)
  value: number;
  created_at: string;
}

export interface HabitWithEntries extends Habit {
  entries: HabitEntry[];
}
