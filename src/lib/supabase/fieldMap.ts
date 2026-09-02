/**
 * Maps user content columns encrypted on write and decrypted on read.
 */
export type FieldMap = Readonly<Record<string, readonly string[]>>;

export const FIELD_MAP: FieldMap = {
  tasks: ["content", "description"],
  habits: ["name", "description"],
  projects: ["name"],
  labels: ["name"],
  calendar_events: ["title", "description", "location", "category", "metadata"],
  external_calendars: ["name", "username"],
};

// FIELD_MAP entries holding JSON rather than text — serialized before
// encryption and parsed after decryption.
export const JSON_FIELDS: ReadonlySet<string> = new Set([
  "calendar_events.metadata",
]);
