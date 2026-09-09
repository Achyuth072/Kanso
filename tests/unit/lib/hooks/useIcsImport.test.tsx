import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";

const { parseResult, existingUids, createImpl } = vi.hoisted(() => ({
  parseResult: {
    value: {
      events: [] as CreateCalendarEventInput[],
      errors: [] as unknown[],
    },
  },
  existingUids: { value: [] as string[] },
  createImpl: { fn: vi.fn() },
}));

vi.mock("@/lib/utils/ics-parser", () => ({
  parseICSFile: () => Promise.resolve(parseResult.value),
}));

vi.mock("@/lib/mutations/calendar-event", () => ({
  calendarEventMutations: { create: (input: unknown) => createImpl.fn(input) },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: "user-1" } } } }),
    },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        not: () => builder,
        order: () => builder,
        range: () =>
          Promise.resolve({
            data: existingUids.value.map((uid) => ({ ics_uid: uid })),
            error: null,
          }),
      };
      return builder;
    },
  }),
}));

import {
  useIcsImport,
  ICS_CONFIRM_THRESHOLD,
  type IcsImportPreview,
} from "@/lib/hooks/useIcsImport";

function event(
  overrides: Partial<CreateCalendarEventInput> = {},
): CreateCalendarEventInput {
  return {
    title: "Standup",
    start_time: "2026-06-12T09:00:00.000Z",
    end_time: "2026-06-12T09:30:00.000Z",
    ...overrides,
  };
}

describe("useIcsImport", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    parseResult.value = { events: [], errors: [] };
    existingUids.value = [];
    createImpl.fn.mockImplementation((input: CreateCalendarEventInput) =>
      Promise.resolve({ id: "created", ...input }),
    );
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("threshold is exported for callers to gate the confirmation step", () => {
    expect(ICS_CONFIRM_THRESHOLD).toBeGreaterThan(0);
  });

  it("prepareImport dedupes against existing uids and reports the date range", async () => {
    parseResult.value = {
      events: [
        event({ ics_uid: "a", start_time: "2026-06-12T09:00:00.000Z" }),
        event({ ics_uid: "b", start_time: "2026-06-01T09:00:00.000Z" }),
      ],
      errors: [],
    };
    existingUids.value = ["a"];

    const { result } = renderHook(() => useIcsImport(), { wrapper });

    let preview!: IcsImportPreview | null;
    await act(async () => {
      preview = await result.current.prepareImport(new File([], "x.ics"));
    });

    expect(preview).toMatchObject({
      totalParsed: 2,
      duplicateCount: 1,
      earliest: "2026-06-01T09:00:00.000Z",
      latest: "2026-06-01T09:00:00.000Z",
    });
    expect(preview?.toCreate.map((e) => e.ics_uid)).toEqual(["b"]);
    expect(result.current.preview).toBeNull();
  });

  it("prepareImport surfaces the preview for a large import so the caller can confirm", async () => {
    parseResult.value = {
      events: Array.from({ length: ICS_CONFIRM_THRESHOLD }, (_, i) =>
        event({ ics_uid: `id-${i}` }),
      ),
      errors: [],
    };

    const { result } = renderHook(() => useIcsImport(), { wrapper });

    await act(async () => {
      await result.current.prepareImport(new File([], "x.ics"));
    });

    expect(result.current.preview?.toCreate).toHaveLength(
      ICS_CONFIRM_THRESHOLD,
    );
  });

  it("commitImport writes each event directly and invalidates the cache once", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    parseResult.value = {
      events: [event({ ics_uid: "a" }), event({ ics_uid: "b" })],
      errors: [],
    };

    const { result } = renderHook(() => useIcsImport(), { wrapper });

    let preview!: IcsImportPreview | null;
    await act(async () => {
      preview = await result.current.prepareImport(new File([], "x.ics"));
    });
    await act(async () => {
      await result.current.commitImport(preview);
    });

    expect(createImpl.fn).toHaveBeenCalledTimes(2);
    const invalidations = invalidateSpy.mock.calls.filter(
      (call) =>
        (call[0] as { queryKey?: unknown[] })?.queryKey?.[0] ===
        "calendar-events",
    );
    expect(invalidations).toHaveLength(1);
  });

  it("counts a unique-index conflict as skipped, not a failure", async () => {
    parseResult.value = {
      events: [event({ ics_uid: "a" }), event({ ics_uid: "b" })],
      errors: [],
    };
    createImpl.fn
      .mockResolvedValueOnce({ id: "created" })
      .mockRejectedValueOnce(
        Object.assign(new Error("conflict"), { code: "23505" }),
      );

    const { result } = renderHook(() => useIcsImport(), { wrapper });

    let preview!: IcsImportPreview | null;
    await act(async () => {
      preview = await result.current.prepareImport(new File([], "x.ics"));
    });

    let success;
    await act(async () => {
      success = await result.current.commitImport(preview);
    });

    expect(success).toBe(true);
    expect(createImpl.fn).toHaveBeenCalledTimes(2);
  });

  it("no new events after dedup skips the write loop entirely", async () => {
    parseResult.value = { events: [event({ ics_uid: "a" })], errors: [] };
    existingUids.value = ["a"];

    const { result } = renderHook(() => useIcsImport(), { wrapper });

    let preview!: IcsImportPreview | null;
    await act(async () => {
      preview = await result.current.prepareImport(new File([], "x.ics"));
    });
    await act(async () => {
      await result.current.commitImport(preview);
    });

    expect(createImpl.fn).not.toHaveBeenCalled();
  });

  it("cancelImport clears a pending preview without writing anything", async () => {
    parseResult.value = {
      events: Array.from({ length: ICS_CONFIRM_THRESHOLD }, (_, i) =>
        event({ ics_uid: `id-${i}` }),
      ),
      errors: [],
    };

    const { result } = renderHook(() => useIcsImport(), { wrapper });

    await act(async () => {
      await result.current.prepareImport(new File([], "x.ics"));
    });
    expect(result.current.preview).not.toBeNull();

    act(() => {
      result.current.cancelImport();
    });

    expect(result.current.preview).toBeNull();
    expect(createImpl.fn).not.toHaveBeenCalled();
  });
});
