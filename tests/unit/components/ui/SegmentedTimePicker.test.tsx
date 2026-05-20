import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SegmentedTimePicker } from "@/components/ui/segmented-time-picker";
import React from "react";

// Mock Haptic hook
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("SegmentedTimePicker", () => {
  const onChange = vi.fn();
  const baseDate = new Date(2024, 0, 1, 10, 30); // 10:30 AM

  beforeEach(() => {
    onChange.mockClear();
  });

  it("should change hours when typing numeric keys on desktop", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hourButton = screen.getByLabelText("Adjust Hours");
    hourButton.focus();

    // Test arrow key
    fireEvent.keyDown(hourButton, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledTimes(1);
    let newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(11);

    // Test typing '3'
    fireEvent.keyDown(hourButton, { key: "3" });
    expect(onChange).toHaveBeenCalledTimes(2);
    newDate = onChange.mock.calls[1][0];
    expect(newDate.getHours()).toBe(3);
  });

  it("should change minutes when typing numeric keys on desktop", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const minuteButton = screen.getByLabelText("Adjust Minutes");
    minuteButton.focus();

    fireEvent.keyDown(minuteButton, { key: "4" });
    expect(onChange).toHaveBeenCalledTimes(1);
    let updatedDate = onChange.mock.calls[0][0];
    expect(updatedDate.getMinutes()).toBe(4);

    fireEvent.keyDown(minuteButton, { key: "5" });
    expect(onChange).toHaveBeenCalledTimes(2);
    updatedDate = onChange.mock.calls[1][0];
    expect(updatedDate.getMinutes()).toBe(45);
  });

  it("should handle wheel events on the hour button", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hourButton = screen.getByLabelText("Adjust Hours");
    fireEvent.wheel(hourButton, { deltaY: -100 });

    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(11);
  });

  it("should toggle AM/PM when typing 'a' or 'p'", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const ampmButton = screen.getByLabelText("Toggle AM PM");
    ampmButton.focus();
    fireEvent.keyDown(ampmButton, { key: "p" });

    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(22);
  });

  it("should increment hours when pointer dragging up", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hourButton = screen.getByLabelText("Adjust Hours");

    fireEvent.pointerDown(hourButton, { clientY: 200 });
    fireEvent.pointerUp(hourButton, { clientY: 150 }); // delta = 200 - 150 = 50 (> 20)

    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(11);
  });
});

describe("SegmentedTimePicker Modal Interaction", () => {
  it("should not let arrow keys bubble up to parent when focused on picker segments", () => {
    const onParentKeyDown = vi.fn();
    render(
      <div onKeyDown={onParentKeyDown}>
        <SegmentedTimePicker
          value={new Date(2024, 0, 1, 10, 30)}
          onChange={() => {}}
        />
      </div>,
    );

    const hourButton = screen.getByLabelText("Adjust Hours");
    hourButton.focus();
    fireEvent.keyDown(hourButton, { key: "ArrowUp", bubbles: true });

    expect(onParentKeyDown).not.toHaveBeenCalled();
  });
});
