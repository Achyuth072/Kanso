import { z } from "zod";

export const FocusSettingsSchema = z.object({
  focusDuration: z
    .number()
    .min(1, "Focus duration must be at least 1 minute")
    .max(120),
  shortBreakDuration: z
    .number()
    .min(1, "Short break must be at least 1 minute")
    .max(30),
  longBreakDuration: z
    .number()
    .min(5, "Long break must be at least 5 minutes")
    .max(60),
  sessionsBeforeLongBreak: z
    .number()
    .min(2, "Must be at least 2 sessions")
    .max(10),
  autoStartBreak: z.boolean(),
  autoStartFocus: z.boolean(),
});

export type FocusSettingsInput = z.infer<typeof FocusSettingsSchema>;
