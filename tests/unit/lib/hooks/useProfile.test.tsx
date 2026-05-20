import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProfile } from "@/lib/hooks/useProfile";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock Supabase
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  then: vi.fn((resolve) => resolve({ data: null, error: null })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn(() => mockQuery),
  }),
}));

// Mock Auth
const mockAuthValue: { user: { id: string } | null; isGuestMode: boolean } = {
  user: { id: "test-user-123" },
  isGuestMode: false,
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockAuthValue,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
};

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthValue.user = { id: "test-user-123" };
    mockAuthValue.isGuestMode = false;
    mockQuery.select.mockReturnThis();
    mockQuery.update.mockReturnThis();
    mockQuery.eq.mockReturnThis();
  });

  // Given: Logged in user with profile in DB
  // When:  useProfile is called
  // Then:  It should return the profile with default settings merged
  it("TC-PR-01: should fetch and return profile with merged settings", async () => {
    mockQuery.single.mockResolvedValue({
      data: {
        id: "test-user-123",
        timezone: "Asia/Tokyo",
        settings: { notifications: { morning_briefing: false } },
      },
      error: null,
    });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile).toMatchObject({
      id: "test-user-123",
      timezone: "Asia/Tokyo",
      settings: {
        notifications: {
          morning_briefing: false,
          evening_plan: true,
        },
      },
    });
  });

  // Given: Guest mode is active
  // When:  useProfile is called
  // Then:  It should return null and not attempt fetch
  it("TC-PR-02: should return null in guest mode", async () => {
    mockAuthValue.user = null;
    mockAuthValue.isGuestMode = true;

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    expect(result.current.profile).toBeNull();
    expect(mockQuery.select).not.toHaveBeenCalled();
  });

  // Given: Update settings is called
  // When:  Partial settings are provided
  // Then:  It should merge with current settings and call update
  it("TC-PR-04: should update settings by merging with existing data", async () => {
    mockQuery.single.mockResolvedValue({
      data: {
        id: "test-user-123",
        settings: { notifications: { morning_briefing: true } },
      },
      error: null,
    });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.updateSettings.mutateAsync({
      notifications: {
        morning_briefing: false,
        evening_plan: true,
        due_date_alerts: true,
        do_date_alerts: true,
        timer_alerts: true,
      },
    });

    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          notifications: expect.objectContaining({
            morning_briefing: false,
            evening_plan: true,
          }),
        }),
      }),
    );
  });

  // Given: Update profile is called
  // When:  Timezone is provided
  // Then:  It should call update for the timezone field
  it("TC-PR-05: should update timezone field", async () => {
    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await result.current.updateProfile.mutateAsync({
      timezone: "Europe/Berlin",
    });

    expect(mockQuery.update).toHaveBeenCalledWith({
      timezone: "Europe/Berlin",
    });
  });
});
