import { notify } from "@/lib/notify";
import { isContentKeyUnavailableError } from "@/lib/supabase/wrapClient";

export function handleMutationError(err: unknown) {
  if (isContentKeyUnavailableError(err)) {
    notify.error("Content is locked — unlock the app to save changes.");
    return;
  }

  if (err instanceof TypeError && err.message === "Failed to fetch") {
    notify.error("Network Error. Changes could not be saved.");
    return;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    if (
      msg.includes("401") ||
      msg.includes("not authenticated") ||
      msg.includes("unauthorized")
    ) {
      notify.error("Authentication error. Please log in again.");
      return;
    }

    notify.error(err.message || "An error occurred.");
    return;
  }

  notify.error("An unexpected error occurred.");
}
