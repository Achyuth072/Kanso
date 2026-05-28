import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { DateTimeWizard } from "@/components/ui/date-time-wizard";

/**
 * Reproduces the bug where wheel/touchmove events on the DateTimeWizard's
 * inner scroll container bubble up to document-level handlers installed by
 * `react-remove-scroll` (used by Radix Dialog) and `vaul` (Drawer). Those
 * handlers call `preventDefault()`, killing the native scroll.
 *
 * Fix: attach element-level listeners that call `stopPropagation()` so the
 * event never reaches document. These tests assert that property.
 */
describe("DateTimeWizard scroll isolation from Dialog/Drawer scroll-lock", () => {
  let documentWheelHandler: EventListener & ReturnType<typeof vi.fn>;
  let documentTouchMoveHandler: EventListener & ReturnType<typeof vi.fn>;
  let documentTouchStartHandler: EventListener & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    documentWheelHandler = vi.fn() as EventListener & ReturnType<typeof vi.fn>;
    documentTouchMoveHandler = vi.fn() as EventListener &
      ReturnType<typeof vi.fn>;
    documentTouchStartHandler = vi.fn() as EventListener &
      ReturnType<typeof vi.fn>;
    document.addEventListener("wheel", documentWheelHandler, {
      passive: false,
    });
    document.addEventListener("touchmove", documentTouchMoveHandler, {
      passive: false,
    });
    document.addEventListener("touchstart", documentTouchStartHandler, {
      passive: false,
    });
  });

  afterEach(() => {
    document.removeEventListener("wheel", documentWheelHandler);
    document.removeEventListener("touchmove", documentTouchMoveHandler);
    document.removeEventListener("touchstart", documentTouchStartHandler);
  });

  function renderWizard(compact = true) {
    return render(
      <DateTimeWizard
        date={new Date(2026, 0, 15, 12, 0)}
        setDate={() => {}}
        onClose={() => {}}
        showTime
        compact={compact}
      />,
    );
  }

  function getScrollContainer(container: HTMLElement): HTMLElement {
    const el = container.querySelector(".overflow-y-auto");
    if (!(el instanceof HTMLElement)) {
      throw new Error("scroll container not found");
    }
    return el;
  }

  it("stops wheel events from reaching document (compact mode)", () => {
    const { container } = renderWizard(true);
    const scroll = getScrollContainer(container);

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
    });
    scroll.dispatchEvent(event);

    expect(documentWheelHandler).not.toHaveBeenCalled();
  });

  it("stops touchmove events from reaching document (compact mode)", () => {
    const { container } = renderWizard(true);
    const scroll = getScrollContainer(container);

    const event = new Event("touchmove", { bubbles: true, cancelable: true });
    scroll.dispatchEvent(event);

    expect(documentTouchMoveHandler).not.toHaveBeenCalled();
  });

  it("stops touchstart events from reaching document (compact mode)", () => {
    const { container } = renderWizard(true);
    const scroll = getScrollContainer(container);

    const event = new Event("touchstart", { bubbles: true, cancelable: true });
    scroll.dispatchEvent(event);

    expect(documentTouchStartHandler).not.toHaveBeenCalled();
  });

  it("also stops wheel events in non-compact mode (mobile inline path)", () => {
    const { container } = renderWizard(false);
    const scroll = getScrollContainer(container);

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
    });
    scroll.dispatchEvent(event);

    expect(documentWheelHandler).not.toHaveBeenCalled();
  });

  it("also stops touchmove events in non-compact mode", () => {
    const { container } = renderWizard(false);
    const scroll = getScrollContainer(container);

    const event = new Event("touchmove", { bubbles: true, cancelable: true });
    scroll.dispatchEvent(event);

    expect(documentTouchMoveHandler).not.toHaveBeenCalled();
  });
});
