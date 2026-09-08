export type FieldMap = Readonly<Record<string, readonly string[]>>;

export const FIELD_MAP: FieldMap = {
  tasks: ["content", "description"],
  habits: ["name", "description"],
  projects: ["name"],
  labels: ["name"],
  calendar_events: ["title", "description", "location", "category", "metadata"],
  external_calendars: ["name", "username"],
  habit_imports: ["raw", "file_name"],
};

// Serialized before encryption and parsed after decryption.
export const JSON_FIELDS: ReadonlySet<string> = new Set([
  "calendar_events.metadata",
  "habit_imports.raw",
]);
