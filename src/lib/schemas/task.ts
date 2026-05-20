import { z } from "zod";

const PrioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const TaskSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  project_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  content: z.string().min(1, "Task content is required").max(500),
  description: z.string().max(5000).nullable().optional(),
  priority: PrioritySchema.default(4),
  due_date: z.string().datetime().nullable().optional(),
  is_completed: z.boolean().default(false),
  completed_at: z.string().datetime().nullable().optional(),
  day_order: z.number().int().default(0),
  recurrence: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
      interval: z.number(),
      days: z.array(z.number()).optional(),
      mode: z.enum(["strict", "flexible"]).optional(),
    })
    .nullable()
    .optional(),
  google_event_id: z.string().max(255).nullable().optional(),
  google_etag: z.string().max(255).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateTaskSchema = z.object({
  content: z.string().min(1, "Task content is required").max(500),
  description: z.string().max(5000).optional(),
  priority: PrioritySchema.optional(),
  due_date: z
    .union([z.date(), z.string().datetime({ offset: true })])
    .nullable()
    .optional(),
  do_date: z
    .union([z.date(), z.string().datetime({ offset: true })])
    .nullable()
    .optional(),
  is_evening: z.boolean().default(false).optional(),
  project_id: z.string().nullable().optional(),
  parent_id: z.string().optional(),
  recurrence: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
      interval: z.number(),
      days: z.array(z.number()).optional(),
      mode: z.enum(["strict", "flexible"]).optional(),
    })
    .nullable()
    .optional(),
});

export const UpdateTaskSchema = z.object({
  id: z.string(),
  content: z.string().min(1, "Task content is required").max(500).optional(),
  description: z.string().max(5000).optional(),
  priority: PrioritySchema.optional(),
  due_date: z
    .union([z.date(), z.string().datetime({ offset: true })])
    .nullable()
    .optional(),
  is_completed: z.boolean().optional(),
  day_order: z.number().int().optional(),
  project_id: z.string().nullable().optional(),
});

export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
