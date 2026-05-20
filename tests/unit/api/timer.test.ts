import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  POST as timerStartPOST,
  DELETE as timerCancelDELETE,
} from "@/../app/api/timer/start/route";

// Mock Supabase Server Client
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  then: vi.fn((resolve) => resolve({ data: null, error: null })),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockQuery),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Timer API Routes (/api/timer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.select.mockReturnThis();
    mockQuery.insert.mockReturnThis();
    mockQuery.update.mockReturnThis();
    mockQuery.delete.mockReturnThis();
    mockQuery.eq.mockReturnThis();
  });

  describe("POST /api/timer/start", () => {
    it("TC-TI-01: should schedule notification when enabled", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      // single() called for: 1. profile, 2. insert result
      mockQuery.single
        .mockResolvedValueOnce({
          data: { settings: { notifications: { timer_alerts: true } } },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: "notif-99" }, error: null });

      const request = new Request("http://localhost/api/timer/start", {
        method: "POST",
        body: JSON.stringify({
          duration: 1500,
          mode: "focus",
        }),
      });

      const response = await timerStartPOST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.notificationId).toBe("notif-99");
    });

    it("TC-TI-02: should skip scheduling when disabled in settings", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      // single() called for: 1. profile
      mockQuery.single.mockResolvedValueOnce({
        data: { settings: { notifications: { timer_alerts: false } } },
        error: null,
      });

      const request = new Request("http://localhost/api/timer/start", {
        method: "POST",
        body: JSON.stringify({
          duration: 1500,
          mode: "focus",
        }),
      });

      const response = await timerStartPOST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBeNull();
      expect(body.message).toContain("notifications are disabled");
    });

    it("TC-TI-04: should return 400 for invalid duration", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      const request = new Request("http://localhost/api/timer/start", {
        method: "POST",
        body: JSON.stringify({
          duration: -10,
          mode: "focus",
        }),
      });

      const response = await timerStartPOST(request);
      expect(response.status).toBe(400);
    });

    it("TC-TI-05: should return 401 for anonymous users", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = new Request("http://localhost/api/timer/start", {
        method: "POST",
        body: JSON.stringify({ duration: 1500 }),
      });

      const response = await timerStartPOST(request);
      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/timer/start", () => {
    it("TC-TI-06: should cancel an existing notification", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      // DELETE request in route.ts uses .update().eq().eq()
      // Since it's awaited at root (no single()), we use mockQuery.then
      mockQuery.then.mockImplementationOnce((resolve) =>
        resolve({ error: null }),
      );

      const request = new Request("http://localhost/api/timer/start", {
        method: "DELETE",
        body: JSON.stringify({ notificationId: "notif-99" }),
      });

      const response = await timerCancelDELETE(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledWith({ status: "cancelled" });
    });
  });
});
