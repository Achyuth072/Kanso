import { renderHook, act } from "@testing-library/react";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { removePushSubscription, syncPushSubscription } from "@/lib/push-api";

const mockSetNotificationsEnabled = vi.fn();
let mockNotificationsEnabled = false;

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((selector) => {
    const state = {
      notificationsEnabled: mockNotificationsEnabled,
      setNotificationsEnabled: mockSetNotificationsEnabled,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/lib/push-api", () => ({
  syncPushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
  sendPushNotification: vi.fn(),
}));

describe("usePushNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsEnabled = false;

    Object.defineProperty(window, "Notification", {
      value: {
        permission: "granted",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
      writable: true,
    });

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi
              .fn()
              .mockResolvedValue({ endpoint: "https://new.test" }),
          },
          showNotification: vi.fn(),
        }),
      },
      writable: true,
    });

    Object.defineProperty(window, "PushManager", {
      value: {},
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("TC-HOOK-01: should not throw on mount", async () => {
    await act(async () => {
      expect(() => {
        renderHook(() => usePushNotifications());
      }).not.toThrow();
    });
  });

  it("TC-HOOK-02: should handle missing VAPID key gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "";

    const { result } = renderHook(() => usePushNotifications());

    const sub = await act(async () => {
      return await result.current.subscribeToPush();
    });

    expect(sub).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith("VAPID public key not configured");

    consoleSpy.mockRestore();
  });

  it("TC-HOOK-03: should sync an existing subscription on mount when notifications are enabled", async () => {
    mockNotificationsEnabled = true;

    const existingSubscription = {
      endpoint: "https://existing.test",
      unsubscribe: vi.fn(),
      toJSON: () => ({}),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(existingSubscription),
            subscribe: vi.fn(),
          },
          showNotification: vi.fn(),
        }),
      },
      writable: true,
    });

    await act(async () => {
      renderHook(() => usePushNotifications());
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(syncPushSubscription).toHaveBeenCalledWith(existingSubscription);
  });

  it("TC-HOOK-04: should force refresh an existing subscription when requested", async () => {
    const oldSubscription = {
      endpoint: "https://old.test",
      unsubscribe: vi.fn().mockResolvedValue(true),
      toJSON: () => ({}),
    };
    const newSubscription = {
      endpoint: "https://new.test",
      unsubscribe: vi.fn(),
      toJSON: () => ({}),
    };

    const subscribeSpy = vi.fn().mockResolvedValue(newSubscription);

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(oldSubscription),
            subscribe: subscribeSpy,
          },
          showNotification: vi.fn(),
        }),
      },
      writable: true,
    });

    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
      "BNPSNsXhfz1CMwPylzXlvTqv0XQlVLBR7xlNpLprGhVyjO30MTn0v0hwQ1x--Y0_nq42RG-FMqxGHKbsHxr0K20";

    const { result } = renderHook(() => usePushNotifications());

    const sub = await act(async () => {
      return await result.current.subscribeToPush("granted", {
        forceRefresh: true,
      });
    });

    expect(oldSubscription.unsubscribe).toHaveBeenCalled();
    expect(removePushSubscription).toHaveBeenCalledWith("https://old.test");
    expect(subscribeSpy).toHaveBeenCalled();
    expect(syncPushSubscription).toHaveBeenCalledWith(newSubscription);
    expect(sub).toBe(newSubscription);
  });

  it("TC-HOOK-05: should return permission and subscription from requestPermission", async () => {
    const freshSubscription = {
      endpoint: "https://fresh.test",
      unsubscribe: vi.fn(),
      toJSON: () => ({}),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi.fn().mockResolvedValue(freshSubscription),
          },
          showNotification: vi.fn(),
        }),
      },
      writable: true,
    });

    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
      "BNPSNsXhfz1CMwPylzXlvTqv0XQlVLBR7xlNpLprGhVyjO30MTn0v0hwQ1x--Y0_nq42RG-FMqxGHKbsHxr0K20";

    const { result } = renderHook(() => usePushNotifications());

    const permissionResult = await act(async () => {
      return await result.current.requestPermission({ forceRefresh: true });
    });

    expect(permissionResult.permission).toBe("granted");
    expect(permissionResult.subscription).toBeDefined();
  });

  it("TC-HOOK-06: should disable notifications even if state subscription is null", async () => {
    const existingSubscription = {
      endpoint: "https://existing.test",
      unsubscribe: vi.fn().mockResolvedValue(true),
      toJSON: () => ({}),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(existingSubscription),
            subscribe: vi.fn(),
          },
          showNotification: vi.fn(),
        }),
      },
      writable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(mockSetNotificationsEnabled).toHaveBeenCalledWith(false);
  });
});
