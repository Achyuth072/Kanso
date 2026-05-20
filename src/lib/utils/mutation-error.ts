import { toast } from "sonner";

/**
 * Handles mutation errors by displaying appropriate toasts.
 * Distinguishes between network errors, authentication errors, and general server errors.
 */
export function handleMutationError(err: unknown) {
  // standard fetch network error
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    toast.error("Network Error. Changes could not be saved.");
    return;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // Auth errors
    if (
      msg.includes("401") ||
      msg.includes("not authenticated") ||
      msg.includes("unauthorized")
    ) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    // Generic error
    toast.error(err.message || "An error occurred.");
    return;
  }

  // Fallback
  toast.error("An unexpected error occurred.");
}
