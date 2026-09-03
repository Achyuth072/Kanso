const SAFE_CODE = /^[A-Za-z0-9_-]{1,32}$/;

// Omits message to prevent leaking user payloads echoed in db/provider errors.
export function describeError(error: unknown): string {
  if (typeof error !== "object" || error === null) return "UnknownError";

  const { name, code, status, statusCode } = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  const parts = [typeof name === "string" && name ? name : "Error"];
  if (typeof code === "string" && SAFE_CODE.test(code))
    parts.push(`code=${code}`);
  const httpStatus = typeof status === "number" ? status : statusCode;
  if (typeof httpStatus === "number") parts.push(`status=${httpStatus}`);
  return parts.join(" ");
}
