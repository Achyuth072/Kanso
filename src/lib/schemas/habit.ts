import { z } from "zod";

export const HabitSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1, "Habit name is required").max(100),
  description: z.string().max(500).nullable().optional(),
  color: z
    .string()
    .regex(/^#[A-Fa-f0-9]{6}$/, "Invalid color format")
    .default("#4B6CB7"),
  icon: z.string().max(50).nullable().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  archived_at: z.string().datetime().nullable().optional(),
});

export const CreateHabitSchema = z.object({
  name: z.string().min(1, "Habit name is required").max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[A-Fa-f0-9]{6}$/, "Invalid color format")
    .optional(),
  icon: z.string().max(50).optional(),
  start_date: z
    .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional(),
});

export const UpdateHabitSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[A-Fa-f0-9]{6}$/, "Invalid color format")
    .optional(),
  icon: z.string().max(50).optional(),
  archived_at: z.string().datetime().nullable().optional(),
});

export type Habit = z.infer<typeof HabitSchema>;
export type CreateHabitInput = z.infer<typeof CreateHabitSchema>;
export type UpdateHabitInput = z.infer<typeof UpdateHabitSchema>;
