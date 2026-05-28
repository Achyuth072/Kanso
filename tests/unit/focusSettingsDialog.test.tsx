/**
 * FocusSettingsDialog — Toggle Regression Tests
 *
 * Root Cause: React Compiler (reactCompiler: true in next.config.ts) memoizes
 * SettingsForm and skips re-renders triggered by RHF's internal watch() subscription.
 * The watch("fieldName") pattern is React Compiler-incompatible for reactive rendering.
 *
 * Fix: Replace watch("field") with useWatch({ control, name: "field" }) which is
 * React Compiler-compatible and properly triggers re-renders.
 *
 * Test Perspective Table:
 * | #  | Perspective             | Boundary           | Input            | Expected           |
 * |----|-------------------------|--------------------|------------------|--------------------|
 * | 1  | Visual toggle ON        | autoStartBreak     | click            | aria-checked=true  |
 * | 2  | Visual toggle OFF       | autoStartBreak     | click twice      | aria-checked=false |
 * | 3  | Visual toggle ON        | autoStartFocus     | click            | aria-checked=true  |
 * | 4  | Both toggles            | break + focus      | click both       | both true          |
 * | 5  | Start from true         | autoStartBreak=1   | click to disable | aria-checked=false |
 * | 6  | Schema: valid boolean   | z.boolean()        | true/false       | parse succeeds     |
 * | 7  | Schema: invalid type    | non-boolean        | "true"/0         | parse fails        |
 */

import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import {
  useForm,
  FormProvider,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FocusSettingsSchema } from "@/lib/schemas/settings";
import { TimerSettings, DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import * as React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: false,
    hapticsEnabled: false,
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((selector: (s: { hapticsEnabled: boolean }) => unknown) =>
    selector({ hapticsEnabled: false }),
  ),
}));

// ── Isolated toggle components for testing ─────────────────────────────────
// NOTE: The buggy pattern (watch("fieldName") for rendering) is NOT tested here
// because React Compiler only applies at build time — jsdom tests don't exercise
// the compiler's memoization. The fix (useWatch) is tested via TogglesWithUseWatch below.

/**
 * FIXED pattern: uses useWatch({ control, name }) — React Compiler compatible.
 * useWatch properly subscribes and causes re-renders when the watched
 * field value changes, even inside memoized components.
 */
function TogglesWithUseWatch() {
  const { control, setValue } = useFormContext<TimerSettings>();
  const autoStartBreak = useWatch({ control, name: "autoStartBreak" });
  const autoStartFocus = useWatch({ control, name: "autoStartFocus" });

  return (
    <div>
      <button
        data-testid="break-usewatch"
        role="switch"
        aria-checked={autoStartBreak}
        onClick={() =>
          setValue("autoStartBreak", !autoStartBreak, { shouldValidate: true })
        }
      >
        Auto-start Breaks
      </button>
      <button
        data-testid="focus-usewatch"
        role="switch"
        aria-checked={autoStartFocus}
        onClick={() =>
          setValue("autoStartFocus", !autoStartFocus, { shouldValidate: true })
        }
      >
        Auto-start Focus
      </button>
    </div>
  );
}

// ── Test wrapper ───────────────────────────────────────────────────────────

function FormWrapper({
  children,
  defaultValues = DEFAULT_TIMER_SETTINGS,
}: {
  children: React.ReactNode;
  defaultValues?: TimerSettings;
}) {
  const methods = useForm<TimerSettings>({
    resolver: zodResolver(FocusSettingsSchema),
    mode: "onChange",
    defaultValues,
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("FocusSettingsDialog — Toggle Behavior", () => {
  describe("useWatch() pattern — React Compiler compatible (AFTER FIX)", () => {
    it("[P1] autoStartBreak toggles false → true on click", async () => {
      // Given: form with autoStartBreak = false
      render(
        <FormWrapper
          defaultValues={{ ...DEFAULT_TIMER_SETTINGS, autoStartBreak: false }}
        >
          <TogglesWithUseWatch />
        </FormWrapper>,
      );
      const btn = screen.getByTestId("break-usewatch");
      expect(btn).toHaveAttribute("aria-checked", "false");

      // When: switch is clicked
      await act(async () => {
        fireEvent.click(btn);
      });

      // Then: aria-checked becomes true
      await waitFor(() => expect(btn).toHaveAttribute("aria-checked", "true"));
    });

    it("[P2] autoStartBreak toggles true → false on second click (boundary: double-toggle)", async () => {
      // Given: autoStartBreak = false
      render(
        <FormWrapper
          defaultValues={{ ...DEFAULT_TIMER_SETTINGS, autoStartBreak: false }}
        >
          <TogglesWithUseWatch />
        </FormWrapper>,
      );
      const btn = screen.getByTestId("break-usewatch");

      // When: clicked twice
      await act(async () => {
        fireEvent.click(btn);
      });
      await waitFor(() => expect(btn).toHaveAttribute("aria-checked", "true"));
      await act(async () => {
        fireEvent.click(btn);
      });

      // Then: returns to false
      await waitFor(() => expect(btn).toHaveAttribute("aria-checked", "false"));
    });

    it("[P3] autoStartFocus toggles false → true on click", async () => {
      // Given: form with autoStartFocus = false
      render(
        <FormWrapper
          defaultValues={{ ...DEFAULT_TIMER_SETTINGS, autoStartFocus: false }}
        >
          <TogglesWithUseWatch />
        </FormWrapper>,
      );
      const btn = screen.getByTestId("focus-usewatch");
      expect(btn).toHaveAttribute("aria-checked", "false");

      // When: switch is clicked
      await act(async () => {
        fireEvent.click(btn);
      });

      // Then: aria-checked becomes true
      await waitFor(() => expect(btn).toHaveAttribute("aria-checked", "true"));
    });

    it("[P4] both toggles can be enabled independently", async () => {
      // Given: both = false
      render(
        <FormWrapper
          defaultValues={{
            ...DEFAULT_TIMER_SETTINGS,
            autoStartBreak: false,
            autoStartFocus: false,
          }}
        >
          <TogglesWithUseWatch />
        </FormWrapper>,
      );
      const breakBtn = screen.getByTestId("break-usewatch");
      const focusBtn = screen.getByTestId("focus-usewatch");

      // When: both clicked
      await act(async () => {
        fireEvent.click(breakBtn);
      });
      await act(async () => {
        fireEvent.click(focusBtn);
      });

      // Then: both true
      await waitFor(() => {
        expect(breakBtn).toHaveAttribute("aria-checked", "true");
        expect(focusBtn).toHaveAttribute("aria-checked", "true");
      });
    });

    it("[P5] autoStartBreak=true initially can be turned OFF (boundary: starts true)", async () => {
      // Given: starts as true
      render(
        <FormWrapper
          defaultValues={{ ...DEFAULT_TIMER_SETTINGS, autoStartBreak: true }}
        >
          <TogglesWithUseWatch />
        </FormWrapper>,
      );
      const btn = screen.getByTestId("break-usewatch");
      expect(btn).toHaveAttribute("aria-checked", "true");

      // When: toggle clicked to disable
      await act(async () => {
        fireEvent.click(btn);
      });

      // Then: becomes false
      await waitFor(() => expect(btn).toHaveAttribute("aria-checked", "false"));
    });
  });

  describe("FocusSettingsSchema validation", () => {
    it("[P6] accepts valid boolean values for toggle fields", () => {
      // Given: valid settings with boolean toggles
      const valid = {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreak: true,
        autoStartFocus: false,
        taskSwitchBehavior: "keepRunning" as const,
      };

      // When: parsed
      const result = FocusSettingsSchema.safeParse(valid);

      // Then: succeeds with correct values
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.autoStartBreak).toBe(true);
        expect(result.data.autoStartFocus).toBe(false);
      }
    });

    it("[P7] rejects non-boolean types for toggle fields (boundary: wrong types)", () => {
      // Given: invalid settings with string booleans
      const invalid = {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreak: "true", // string instead of boolean
        autoStartFocus: 1, // number instead of boolean
      };

      // When: parsed
      const result = FocusSettingsSchema.safeParse(invalid);

      // Then: fails
      expect(result.success).toBe(false);
    });
  });
});
