import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FocusSettingsDialog } from "@/components/FocusSettingsDialog";

const mockUpdateSettings = vi.fn();
vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({
    state: {
      mode: "focus",
      isRunning: false,
      remainingSeconds: 1500,
      completedSessions: 0,
      activeTaskId: null,
      startedAt: null,
    },
    settings: {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreak: false,
      autoStartFocus: false,
      taskSwitchBehavior: "keepRunning",
    },
    isLoaded: true,
    start: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    skip: vi.fn(),
    updateSettings: mockUpdateSettings,
  }),
  TimerProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockHapticTrigger,
    isPhone: false,
  }),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
  }: {
    value: number[];
    onValueChange: (v: number[]) => void;
    min: number;
    max: number;
  }) => (
    <input
      type="range"
      min={min}
      max={max}
      value={value[0]}
      onChange={(e) => onValueChange([parseInt(e.target.value)])}
      aria-label="Slider"
      title="Slider"
    />
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked: boolean;
    onCheckedChange: (c: boolean) => void;
    id: string;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      aria-label="Switch"
      title="Switch"
    />
  ),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true), // Default to desktop
}));

describe("FocusSettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings fields when open", async () => {
    render(<FocusSettingsDialog />);
    await act(async () => {
      fireEvent.click(screen.getByText("Adjust Settings"));
    });

    expect(screen.getByLabelText("Focus Duration")).toBeInTheDocument();
    expect(screen.getByLabelText("Short Break")).toBeInTheDocument();
  });

  it("shows error for invalid duration", async () => {
    render(<FocusSettingsDialog />);
    await act(async () => {
      fireEvent.click(screen.getByText("Adjust Settings"));
    });

    const input = screen.getByLabelText("Focus Duration");
    await act(async () => {
      fireEvent.change(input, { target: { value: "0" } });
    });

    await waitFor(() => {
      expect(
        screen.getByText("Focus duration must be at least 1 minute"),
      ).toBeInTheDocument();
    });

    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("persists slider changes immediately via watch() without clicking Save", async () => {
    // Regression test: setValue() from slider onValueChange fires watch() with type: undefined.
    // The old guard `if (type === "change")` blocked this path, so slider changes were never
    // saved. The fix removes the type guard — only safeParse validation is needed.
    render(<FocusSettingsDialog />);
    await act(async () => {
      fireEvent.click(screen.getByText("Adjust Settings"));
    });

    // The slider mock calls onValueChange([value]) on native onChange, which triggers setValue()
    // internally — this is the exact path that was broken (setValue → watch type: undefined).
    const sliders = screen.getAllByTitle("Slider");
    const focusSlider = sliders[0]; // first slider is Focus Duration
    await act(async () => {
      fireEvent.change(focusSlider, { target: { value: "45" } });
    });

    // updateSettings must be called immediately (not on Save click) via the watch() subscription
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ focusDuration: 45 }),
      );
    });
  });

  it("submits updated settings correctly", async () => {
    render(<FocusSettingsDialog />);
    await act(async () => {
      fireEvent.click(screen.getByText("Adjust Settings"));
    });

    const input = screen.getByLabelText("Focus Duration");
    await act(async () => {
      fireEvent.change(input, { target: { value: "30" } });
    });

    const saveButton = screen.getByText("Save Changes");

    // Wait for the form to be valid and button enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          focusDuration: 30,
        }),
      );
      // Verify haptic feedback (TC-C-01: Major action thud)
      expect(mockHapticTrigger).toHaveBeenCalledWith("thud");
    });
  });
});
