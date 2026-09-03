// No Deno/Node APIs — tests/unit imports this directly.

// PostgrestError carries `message` without being an Error, so instanceof alone misses it.
export function toErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "Unknown error";
}

const SAFE_CODE = /^[A-Za-z0-9_-]{1,32}$/;

// Duplicated from src/lib/errors/describeError.ts (Deno cannot import from src/).
// Omits message to prevent leaking user payloads echoed in db/push errors.
export function describeError(error: unknown): string {
  if (typeof error !== "object" || error === null) return "UnknownError";

  const { name, code, status, statusCode } = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  const parts = [typeof name === "string" && name ? name : "Error"];
  if (typeof code === "string" && SAFE_CODE.test(code)) {
    parts.push(`code=${code}`);
  }
  const httpStatus = typeof status === "number" ? status : statusCode;
  if (typeof httpStatus === "number") parts.push(`status=${httpStatus}`);
  return parts.join(" ");
}
