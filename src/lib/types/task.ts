import type { RecurrenceRule } from "@/lib/utils/recurrence";

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  parent_id: string | null;
  content: string;
  description: string | null;
  priority: 1 | 2 | 3 | 4;
  due_date: string | null;
  do_date: string | null;
  is_evening: boolean;
  is_completed: boolean;
  completed_at: string | null;
  day_order: number;
  recurrence: RecurrenceRule | null;
  google_event_id: string | null;
  google_etag: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  view_style: "list" | "board";
  is_inbox: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  content: string;
  description?: string;
  priority?: 1 | 2 | 3 | 4;
  due_date?: string;
  do_date?: string;
  is_evening?: boolean;
  project_id?: string;
  parent_id?: string;
  recurrence?: RecurrenceRule | null;
}

export interface UpdateTaskInput {
  id: string;
  content?: string;
  description?: string | null;
  priority?: 1 | 2 | 3 | 4;
  due_date?: string | null;
  do_date?: string | null;
  is_evening?: boolean;
  is_completed?: boolean;
  day_order?: number;
  project_id?: string | null;
  recurrence?: RecurrenceRule | null;
}

export interface ParsedTask {
  content: string;
  due_date: Date | null;
  priority: 1 | 2 | 3 | 4;
  project: string | null;
  labels: string[];
}
