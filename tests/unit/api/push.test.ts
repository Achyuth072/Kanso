import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DELETE as unsubscribeDELETE,
  POST as subscribePOST,
} from "@/../app/api/push/subscribe/route";
import { POST as sendPOST } from "@/../app/api/push/send/route";
import { webpush } from "@/lib/push";

const mockAuthGetUser = vi.fn();
const mockFrom = vi.fn();
const mockUpsert = vi.fn();

const mockSupabase = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: mockFrom,
};

function createThenableBuilder<T>(result: T) {
  const builder = {
    eq: vi.fn(() => builder),
    then: (
      onFulfilled?: ((value: T) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/lib/push", () => ({
  webpush: {
    sendNotification: vi.fn(),
  },
}));

describe("Push Notification API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
  });

  describe("POST /api/push/subscribe", () => {
    it("TC-SUB-01: should save subscription for authenticated user", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockFrom.mockReturnValue({
        upsert: mockUpsert,
      });
      mockUpsert.mockResolvedValue({ error: null });

      const request = new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          subscription: { endpoint: "https://test.com", keys: {} },
        }),
      });

      const response = await subscribePOST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          endpoint: "https://test.com",
          subscription: { endpoint: "https://test.com", keys: {} },
        }),
        { onConflict: "user_id,endpoint" },
      );
    });

    it("TC-SUB-02: should return 401 for unauthenticated users", async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });

      const request = new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription: {} }),
      });

      const response = await subscribePOST(request);
      expect(response.status).toBe(401);
    });

    it("TC-SUB-03: should return 400 when subscription is missing", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      const request = new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await subscribePOST(request);
      expect(response.status).toBe(400);
    });

    it("TC-SUB-04: should return 500 on database error", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockFrom.mockReturnValue({
        upsert: mockUpsert,
      });
      mockUpsert.mockResolvedValue({ error: { message: "DB Error" } });

      const request = new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          subscription: { endpoint: "https://test.com", keys: {} },
        }),
      });

      const response = await subscribePOST(request);
      expect(response.status).toBe(500);
    });
  });

  describe("DELETE /api/push/subscribe", () => {
    it("TC-UNSUB-01: should delete a subscription by endpoint for the current user", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      const deleteBuilder = createThenableBuilder({ error: null });
      const deleteMock = vi.fn(() => deleteBuilder);
      mockFrom.mockReturnValue({
        delete: deleteMock,
      });

      const request = new Request(
        "http://localhost/api/push/subscribe?endpoint=https%3A%2F%2Ftest.com",
        {
          method: "DELETE",
        },
      );

      const response = await unsubscribeDELETE(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(deleteBuilder.eq).toHaveBeenNthCalledWith(
        1,
        "user_id",
        "user-123",
      );
      expect(deleteBuilder.eq).toHaveBeenNthCalledWith(
        2,
        "endpoint",
        "https://test.com",
      );
    });
  });

  describe("POST /api/push/send", () => {
    it("TC-SND-01: should send notification to the requested endpoint", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "sender-123" } },
      });

      const selectBuilder = createThenableBuilder({
        data: [{ id: "sub-1", subscription: { endpoint: "https://test.com" } }],
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn(() => selectBuilder),
      });

      vi.mocked(webpush.sendNotification).mockResolvedValue({
        statusCode: 201,
        headers: {},
        body: "",
      });

      const request = new Request("http://localhost/api/push/send", {
        method: "POST",
        body: JSON.stringify({
          userId: "target-456",
          endpoint: "https://test.com",
          title: "Hello",
          body: "World",
        }),
      });

      const response = await sendPOST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        success: true,
        sentCount: 1,
        failedCount: 0,
        endpointMatched: true,
      });
      expect(selectBuilder.eq).toHaveBeenNthCalledWith(
        1,
        "user_id",
        "target-456",
      );
      expect(selectBuilder.eq).toHaveBeenNthCalledWith(
        2,
        "endpoint",
        "https://test.com",
      );
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        { endpoint: "https://test.com" },
        expect.any(String),
        {
          TTL: 60,
          urgency: "high",
          topic: "test-notification",
        },
      );
    });

    it("TC-SND-02: should return 404 if subscriber not found", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "sender-123" } },
      });

      const selectBuilder = createThenableBuilder({
        data: [],
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn(() => selectBuilder),
      });

      const request = new Request("http://localhost/api/push/send", {
        method: "POST",
        body: JSON.stringify({ userId: "missing-user" }),
      });

      const response = await sendPOST(request);
      expect(response.status).toBe(404);
    });

    it("TC-SND-03: should delete expired subscription and return 410 when the targeted endpoint is gone", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "sender-123" } },
      });

      const selectBuilder = createThenableBuilder({
        data: [{ id: "sub-1", subscription: { endpoint: "https://old.com" } }],
        error: null,
      });
      const deleteBuilder = createThenableBuilder({ error: null });
      const deleteMock = vi.fn(() => deleteBuilder);

      mockFrom
        .mockReturnValueOnce({
          select: vi.fn(() => selectBuilder),
        })
        .mockReturnValueOnce({
          delete: deleteMock,
        });

      vi.mocked(webpush.sendNotification).mockRejectedValue({
        statusCode: 410,
      });

      const request = new Request("http://localhost/api/push/send", {
        method: "POST",
        body: JSON.stringify({
          userId: "expired-user",
          endpoint: "https://old.com",
        }),
      });

      const response = await sendPOST(request);
      const body = await response.json();

      expect(response.status).toBe(410);
      expect(body.error).toContain("Re-enable notifications");
      expect(deleteMock).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "sub-1");
    });

    it("TC-SND-04: should return 500 if VAPID private key is missing", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "sender-123" } },
      });

      const originalEnv = process.env;
      process.env = { ...originalEnv, VAPID_PRIVATE_KEY: "" };

      const request = new Request("http://localhost/api/push/send", {
        method: "POST",
        body: JSON.stringify({ userId: "target-456" }),
      });

      try {
        const response = await sendPOST(request);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe("VAPID configuration missing");
      } finally {
        process.env = originalEnv;
      }
    });
  });
});
