import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleMutationError } from "@/lib/utils/mutation-error";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("handleMutationError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ME-A-01: should show network error toast for fetch failures", () => {
    // Given: A fetch TypeError
    const error = new TypeError("Failed to fetch");

    // When: Handling the error
    handleMutationError(error);

    // Then: Network error toast is shown
    expect(toast.error).toHaveBeenCalledWith(
      "Network Error. Changes could not be saved.",
    );
  });

  it("ME-A-02: should show auth error toast for 401 statuses", () => {
    // Given: An error with 401 message
    const error = new Error("Auth failed: 401 Unauthorized");

    // When: Handling the error
    handleMutationError(error);

    // Then: Auth error toast is shown
    expect(toast.error).toHaveBeenCalledWith(
      "Authentication error. Please log in again.",
    );
  });

  it("ME-A-03: should show generic error message for other Error objects", () => {
    // Given: A generic error
    const error = new Error("Database constraints failed");

    // When: Handling the error
    handleMutationError(error);

    // Then: Exact error message is shown
    expect(toast.error).toHaveBeenCalledWith("Database constraints failed");
  });

  it("ME-B-01: should show fallback message for unknown error types", () => {
    // Given: An unknown error type (e.g. string or null)
    const error = "Something went wrong";

    // When: Handling the error
    handleMutationError(error);

    // Then: Fallback toast is shown
    expect(toast.error).toHaveBeenCalledWith("An unexpected error occurred.");
  });
});
