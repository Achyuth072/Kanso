import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useArchiveProject } from "@/lib/hooks/useProjectMutations";
import type { Project } from "@/lib/types/task";
import React from "react";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "test-user" } }),
}));

vi.mock("@/lib/mutations/project", () => ({
  projectMutations: {
    archive: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/utils/mutation-error", () => ({
  handleMutationError: vi.fn(),
}));

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("useArchiveProject", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("optimistically removes project from cache on mutate", async () => {
    const initialProjects: Partial<Project>[] = [
      { id: "1", name: "Project A", is_archived: false },
      { id: "2", name: "Project B", is_archived: false },
    ];
    queryClient.setQueryData(["projects", false], initialProjects);

    const { result } = renderHook(() => useArchiveProject(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("1");

    await waitFor(() => {
      const cached = queryClient.getQueryData<Partial<Project>[]>([
        "projects",
        false,
      ]);
      expect(cached?.length).toBe(1);
      expect(cached?.[0]?.id).toBe("2");
    });
  });

  it("rolls back cache on error", async () => {
    const { projectMutations } = await import("@/lib/mutations/project");
    vi.mocked(projectMutations.archive).mockRejectedValueOnce(
      new Error("Network error"),
    );

    const initialProjects: Partial<Project>[] = [
      { id: "1", name: "Project A", is_archived: false },
    ];
    queryClient.setQueryData(["projects", false], initialProjects);

    const { result } = renderHook(() => useArchiveProject(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("1");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const cached = queryClient.getQueryData<Partial<Project>[]>([
      "projects",
      false,
    ]);
    expect(cached?.length).toBe(1);
    expect(cached?.[0]?.id).toBe("1");
  });
});
