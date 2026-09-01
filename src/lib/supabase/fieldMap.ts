/**
 * Declares table and column pairs holding user content that wrapSupabaseClient
 * encrypts on write and decrypts on read. Unlisted tables and columns pass through.
 */
export type FieldMap = Readonly<Record<string, readonly string[]>>;

export const FIELD_MAP: FieldMap = {};
