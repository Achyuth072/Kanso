import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProfile } from "@/lib/hooks/useProfile";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// We'll use a local mock for auth to allow better control
let mockUser: { id: string } | null = { id: "test-user-123" };
let mockIsGuestMode = false;

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockUser,
    isGuestMode: mockIsGuestMode,
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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
    mockUser = { id: "test-user-123" };
    mockIsGuestMode = false;
  });

  it("TC-PR-01: should fetch profile with settings", async () => {
    mockSupabase.single.mockResolvedValue({
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
    expect(result.current.profile?.id).toBe("test-user-123");
    expect(result.current.profile?.timezone).toBe("Asia/Tokyo");
  });

  it("TC-PR-02: should handle guest mode", async () => {
    mockIsGuestMode = true;
    mockUser = null;

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });
    expect(result.current.profile).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
