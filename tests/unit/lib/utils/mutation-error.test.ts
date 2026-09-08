import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleMutationError } from "@/lib/utils/mutation-error";
import { notify } from "@/lib/notify";

vi.mock("@/lib/notify", () => ({
  notify: {
    error: vi.fn(),
  },
}));

describe("handleMutationError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ME-A-01: should show network error toast for fetch failures", () => {
    const error = new TypeError("Failed to fetch");
    handleMutationError(error);
    expect(notify.error).toHaveBeenCalledWith(
      "Network Error. Changes could not be saved.",
    );
  });

  it("ME-A-02: should show auth error toast for 401 statuses", () => {
    const error = new Error("Auth failed: 401 Unauthorized");
    handleMutationError(error);
    expect(notify.error).toHaveBeenCalledWith(
      "Authentication error. Please log in again.",
    );
  });

  it("ME-A-03: should show generic error message for other Error objects", () => {
    const error = new Error("Database constraints failed");
    handleMutationError(error);
    expect(notify.error).toHaveBeenCalledWith("Database constraints failed");
  });

  it("ME-A-04: should show a locked-content toast for content_key_unavailable errors", () => {
    const error = Object.assign(new Error('Cannot write to "tasks": …'), {
      code: "content_key_unavailable",
    });

    handleMutationError(error);
    expect(notify.error).toHaveBeenCalledWith(
      "Content is locked — unlock the app to save changes.",
    );
  });

  it("ME-B-01: should show fallback message for unknown error types", () => {
    const error = "Something went wrong";
    handleMutationError(error);
    expect(notify.error).toHaveBeenCalledWith("An unexpected error occurred.");
  });
});
