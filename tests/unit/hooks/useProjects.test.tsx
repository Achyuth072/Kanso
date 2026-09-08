import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProjects, useArchivedProjects } from "@/lib/hooks/useProjects";
import React from "react";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

const mockCreateClient = vi.mocked(createClient);
const mockUseAuth = vi.mocked(useAuth);

describe("useProjects", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockUseAuth.mockReturnValue({ isGuestMode: false } as ReturnType<
      typeof useAuth
    >);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("sorts by name client-side, inbox first — name is encrypted, so the DB can't order by it", async () => {
    const rows = [
      { id: "1", name: "Zebra", is_inbox: false },
      { id: "2", name: "Inbox", is_inbox: true },
      { id: "3", name: "Apple", is_inbox: false },
    ];

    mockCreateClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.map((p) => p.name)).toEqual([
      "Inbox",
      "Apple",
      "Zebra",
    ]);
  });

  it("useArchivedProjects sorts by name client-side", async () => {
    const rows = [
      { id: "1", name: "Zebra", is_archived: true },
      { id: "2", name: "Apple", is_archived: true },
    ];

    mockCreateClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const { result } = renderHook(() => useArchivedProjects(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.map((p) => p.name)).toEqual(["Apple", "Zebra"]);
  });
});
