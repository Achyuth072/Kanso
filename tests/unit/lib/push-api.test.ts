import { describe, it, expect, vi } from "vitest";
import { sendPushNotification } from "@/lib/push-api";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("sendPushNotification", () => {
  // Given: The push API returns a 404 (User not subscribed)
  // When:  sendPushNotification is called
  // Then:  It should throw an Error with the message from the API
  it("TC-API-01: should throw error when backend returns 404", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "User not subscribed or subscription not found",
      }),
    });

    await expect(
      sendPushNotification({
        title: "Test",
        body: "Body",
      }),
    ).rejects.toThrow("User not subscribed or subscription not found");
  });

  // Given: The push API returns success
  // When:  sendPushNotification is called
  // Then:  It should return the response JSON
  it("TC-API-02: should return success when backend returns 200", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await sendPushNotification({
      title: "Test",
      body: "Body",
    });

    expect(result).toEqual({ success: true });
  });
});
