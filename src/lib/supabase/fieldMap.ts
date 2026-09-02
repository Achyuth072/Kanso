/**
 * Maps user content columns encrypted on write and decrypted on read.
 */
export type FieldMap = Readonly<Record<string, readonly string[]>>;

export const FIELD_MAP: FieldMap = {
  tasks: ["content", "description"],
};
