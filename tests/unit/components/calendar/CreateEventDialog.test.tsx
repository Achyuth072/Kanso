/**
 * CreateEventDialog — Button Activation Tests
 *
 * Bug: The create/save button remains disabled even after filling in the title
 * (and other fields) in both desktop and mobile views.
 *
 * Root Cause A — React Compiler (build-time):
 *   reactCompiler: true in next.config.ts memoizes CreateEventDialog and skips
 *   re-renders triggered by RHF's proxy-based formState.isValid subscription.
 *   The formState proxy relies on property access to register subscriptions;
 *   React Compiler optimizes that access away, so isValid never updates the UI.
 *
 * Root Cause B — setTimeout(0) race (test-time):
 *   The reset useEffect defers reset() via setTimeout(0). In async test context,
 *   that timer fires after `await act(...)` yields, resetting the form mid-test.
 *
 * Fix A: Replace formState destructuring with useFormState({ control }) — an
 *   explicit hook subscription that React Compiler tracks correctly.
 *   Same pattern as the documented watch() → useWatch() fix in FocusSettingsDialog.
 *
 * Fix B: Use vi.useFakeTimers() + vi.runAllTimers() to flush the deferred reset
 *   before firing change events, making tests deterministic.
 *
 * NOTE: React Compiler only applies at build time — jsdom tests don't exercise
 * the compiler's memoization. These tests validate the form logic is correct
 * and prevent regressions if the fix is reverted.
 *
 * Test Perspective Table:
 * | #  | Perspective              | Boundary          | Input                | Expected                |
 * |----|--------------------------|-------------------|----------------------|-------------------------|
 * | 1  | Initial state            | button disabled   | no input             | button is disabled      |
 * | 2  | Title typed              | min(1)            | type "Meeting"       | button becomes enabled  |
 * | 3  | Title cleared            | min(1) boundary   | type then clear      | button re-disabled      |
 * | 4  | Description only         | optional field    | fill desc, no title  | button stays disabled   |
 * | 5  | Schema: empty title      | z.string().min(1) | ""                   | validation fails        |
 * | 6  | Schema: valid title      | z.string().min(1) | "Event"              | validation passes       |
 * | 7  | Schema: max 200 chars    | max(200)          | 200 chars            | validation passes       |
 * | 8  | Schema: over 200 chars   | max(200)+1        | 201 chars            | validation fails        |
 * | 9  | Edit mode: pre-filled    | existing event    | event with title     | button enabled on open  |
 * | 10 | Edit mode: clear title   | min(1) boundary   | clear existing title | button re-disabled      |
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { z } from "zod";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: false,
    hapticsEnabled: false,
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true), // fine pointer = desktop
}));

vi.mock("@/lib/hooks/useCalendarEventMutations", () => ({
  useCreateCalendarEvent: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUpdateCalendarEvent: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteCalendarEvent: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/utils/nlp-event", () => ({
  parseEventInput: vi.fn(() => ({
    start: null,
    end: null,
    allDay: false,
  })),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: vi.fn((selector: (s: { events: never[] }) => unknown) =>
    selector({ events: [] }),
  ),
}));

// ── Schema tests (unit level) ───────────────────────────────────────────────

describe("CreateEventSchema — validation", () => {
  const CreateEventSchema = z.object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
    all_day: z.boolean().default(false),
  });

  it("[P5] empty title fails validation", () => {
    const result = CreateEventSchema.safeParse({
      title: "",
      description: "",
      location: "",
      all_day: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Title is required");
    }
  });

  it("[P6] valid title passes validation", () => {
    const result = CreateEventSchema.safeParse({
      title: "Team Meeting",
      description: "",
      location: "",
      all_day: false,
    });
    expect(result.success).toBe(true);
  });

  it("[P7] max-length title (200 chars) passes", () => {
    const result = CreateEventSchema.safeParse({
      title: "a".repeat(200),
      description: "",
      location: "",
      all_day: false,
    });
    expect(result.success).toBe(true);
  });

  it("[P8] over-max-length title (201 chars) fails", () => {
    const result = CreateEventSchema.safeParse({
      title: "a".repeat(201),
      description: "",
      location: "",
      all_day: false,
    });
    expect(result.success).toBe(false);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

const defaultDate = new Date("2025-06-01T10:00:00");

/**
 * Flush the deferred reset() from the open useEffect.
 * The effect uses setTimeout(0) to defer reset(), which in async test context
 * can race with change events. Flushing before interaction makes tests stable.
 */
async function flushResetTimer() {
  await act(async () => {
    vi.runAllTimers();
  });
}

function typeIntoTitle(text: string) {
  const input = screen.getByPlaceholderText(/lunch at 1pm tomorrow/i);
  fireEvent.change(input, { target: { value: text } });
  return input;
}

// ── Component tests — create mode ──────────────────────────────────────────

describe("CreateEventDialog — button activation (create mode)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("[P1] submit button is disabled on initial render (empty title)", async () => {
    // Given: dialog opens with no pre-filled title
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        defaultDate={defaultDate}
      />,
    );

    // Flush the deferred reset
    await flushResetTimer();

    // Then: the submit button is disabled because title is required
    expect(
      screen.getByRole("button", { name: /create event/i }),
    ).toBeDisabled();
  });

  it("[P2] submit button becomes enabled after typing a valid title", async () => {
    // Given: dialog opens
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        defaultDate={defaultDate}
      />,
    );

    // Flush the deferred reset so form is in clean initial state
    await flushResetTimer();

    // Confirm button starts disabled
    expect(
      screen.getByRole("button", { name: /create event/i }),
    ).toBeDisabled();

    // When: user types a title
    await act(async () => {
      typeIntoTitle("Team Meeting");
    });

    // Then: button becomes enabled
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create event/i }),
      ).not.toBeDisabled();
    });
  });

  it("[P3] button re-disables when title is cleared", async () => {
    // Given: dialog with a typed title
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        defaultDate={defaultDate}
      />,
    );

    await flushResetTimer();

    // Type title → button enables
    await act(async () => {
      typeIntoTitle("Meeting");
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /create event/i }),
      ).not.toBeDisabled(),
    );

    // When: title is cleared
    await act(async () => {
      typeIntoTitle("");
    });

    // Then: button is disabled again
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create event/i }),
      ).toBeDisabled();
    });
  });

  it("[P4] filling description alone does NOT enable button (title required)", async () => {
    // Given: dialog opens
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        defaultDate={defaultDate}
      />,
    );

    await flushResetTimer();

    // When: user fills description (not title)
    await act(async () => {
      const descInput = screen.getByPlaceholderText(/add notes/i);
      fireEvent.change(descInput, { target: { value: "Some notes here" } });
    });

    // Then: button remains disabled — title is still empty
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create event/i }),
      ).toBeDisabled();
    });
  });
});

// ── Component tests — edit mode ────────────────────────────────────────────

describe("CreateEventDialog — button activation (edit mode)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const editEvent = {
    id: "evt-123",
    title: "Existing Meeting",
    description: "Some desc",
    location: "Office",
    start: new Date("2025-06-01T10:00:00"),
    end: new Date("2025-06-01T11:00:00"),
    allDay: false,
    color: "#000",
    calendarId: "cal-1",
  };

  it("[P9] save button is enabled when editing event with existing title", async () => {
    // Given: dialog opens in edit mode with existing event data
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        event={editEvent}
      />,
    );

    // Flush the deferred reset which populates form with event data
    await flushResetTimer();

    // Then: save button should be enabled (title is pre-filled from event)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save changes/i }),
      ).not.toBeDisabled();
    });
  });

  it("[P10] save button re-disables if title is cleared in edit mode", async () => {
    // Given: edit mode with pre-filled title
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        event={editEvent}
      />,
    );

    // Wait for save button to be enabled (form initialized with event.title)
    await flushResetTimer();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /save changes/i }),
      ).not.toBeDisabled(),
    );

    // When: title is cleared
    await act(async () => {
      const titleInput = screen.getByDisplayValue("Existing Meeting");
      fireEvent.change(titleInput, { target: { value: "" } });
    });

    // Then: button should be disabled
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save changes/i }),
      ).toBeDisabled();
    });
  });
});

// ── Race condition tests — setTimeout(0) reset ─────────────────────────────

describe("CreateEventDialog — setTimeout(0) reset race condition", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("[P11] setTimeout(0) reset clears title typed before timer fires — documents race condition", async () => {
    // Given: dialog opens — reset useEffect schedules setTimeout(0)
    render(
      <CreateEventDialog
        open={true}
        onOpenChange={vi.fn()}
        defaultDate={defaultDate}
      />,
    );

    // Confirm button starts disabled (no title)
    const button = screen.getByRole("button", { name: /create event/i });
    expect(button).toBeDisabled();

    // When: user types title BEFORE the setTimeout(0) reset fires
    // (simulating fast user input on a busy main thread where setTimeout is delayed)
    await act(async () => {
      typeIntoTitle("Test");
    });

    // Then: title shows in input, button enables (isFormValid=true)
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    // NOW the reset timer fires — race condition:
    // deferred reset() clears title, re-disabling the button
    await act(async () => {
      vi.runAllTimers();
    });

    // After reset, title is cleared, button re-disables
    // NOTE: In production, the user would need to type within ~4ms of opening
    // the dialog for this race to occur. The PRIMARY fix for the button-disabled
    // bug is "use no memo" (React Compiler bailout) + useWatch-derived isFormValid.
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    const titleInput = screen.getByPlaceholderText(/lunch at 1pm tomorrow/i);
    expect(titleInput).toHaveValue("");
  });

  it("[P12] without defaultDate prop — ensure dates are still valid and button enables after typing", async () => {
    // Given: dialog opens WITHOUT a defaultDate (e.g., from toolbar "+" button)
    render(<CreateEventDialog open={true} onOpenChange={vi.fn()} />);

    await flushResetTimer();

    // Confirm button starts disabled
    const button = screen.getByRole("button", { name: /create event/i });
    expect(button).toBeDisabled();

    // When: user types a title
    await act(async () => {
      typeIntoTitle("Team Meeting");
    });

    // Then: button should enable — dates should be valid even without defaultDate
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
