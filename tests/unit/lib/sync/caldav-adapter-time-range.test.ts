import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchCalendarEvents = vi.fn();

vi.mock("@/lib/caldav/client", () => ({
  createCalDAVClient: vi.fn(),
  discoverCalendars: vi.fn(),
  fetchCalendarEvents: (...args: unknown[]) => fetchCalendarEvents(...args),
  pushEventToServer: vi.fn(),
  deleteEventFromServer: vi.fn(),
}));

async function makeAdapter() {
  const { registerAdapter, getAdapter } =
    await import("@/lib/sync/adapter-interface");
  await import("@/lib/sync/caldav-adapter");
  void registerAdapter;
  const adapter = getAdapter("caldav");
  // @ts-expect-error private
  adapter.client = {};
  // @ts-expect-error private
  adapter.externalCalendar = { calendar_url: "https://caldav.example/cal" };
  return adapter;
}

describe("CalDAVAdapter.fullSync — time range", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchCalendarEvents.mockResolvedValue({
      events: [],
      syncToken: "",
      deleted: [],
    });
  });

  it("bounds the fetch to pastDays/futureDays instead of pulling the whole calendar", async () => {
    const adapter = await makeAdapter();
    const before = Date.now();

    await adapter.fullSync(10, 20);

    const [, , , timeRange] = fetchCalendarEvents.mock.calls[0];
    const start = new Date(timeRange.start).getTime();
    const end = new Date(timeRange.end).getTime();

    expect(before - start).toBeCloseTo(10 * 24 * 60 * 60 * 1000, -3);
    expect(end - before).toBeCloseTo(20 * 24 * 60 * 60 * 1000, -3);
  });

  it("defaults to 90 days back / 365 forward", async () => {
    const adapter = await makeAdapter();

    await adapter.fullSync();

    const [, , , timeRange] = fetchCalendarEvents.mock.calls[0];
    const spanDays =
      (new Date(timeRange.end).getTime() -
        new Date(timeRange.start).getTime()) /
      (24 * 60 * 60 * 1000);

    expect(spanDays).toBeCloseTo(455, 0);
  });
});
