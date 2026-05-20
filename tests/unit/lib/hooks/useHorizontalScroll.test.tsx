import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";

let resizeObserverCallback: ResizeObserverCallback | null = null;

class TestResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
}

function createScroller({
  clientWidth,
  scrollWidth,
  scrollLeft,
}: {
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
}) {
  const element = document.createElement("div");
  let currentClientWidth = clientWidth;
  let currentScrollWidth = scrollWidth;
  let currentScrollLeft = scrollLeft;

  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    get: () => currentClientWidth,
  });
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    get: () => currentScrollWidth,
  });
  Object.defineProperty(element, "scrollLeft", {
    configurable: true,
    get: () => currentScrollLeft,
    set: (value: number) => {
      currentScrollLeft = value;
    },
  });

  document.body.appendChild(element);

  return {
    element,
    getScrollLeft: () => currentScrollLeft,
    setClientWidth: (value: number) => {
      currentClientWidth = value;
    },
    setScrollWidth: (value: number) => {
      currentScrollWidth = value;
    },
    cleanup: () => {
      element.remove();
    },
  };
}

function triggerResize(width: number) {
  if (!resizeObserverCallback) {
    throw new Error("ResizeObserver callback was not registered");
  }

  resizeObserverCallback(
    [
      {
        contentRect: {
          width,
          height: 0,
          top: 0,
          right: width,
          bottom: 0,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        },
      } as ResizeObserverEntry,
    ],
    {} as ResizeObserver,
  );
}

describe("useHorizontalScroll", () => {
  beforeEach(() => {
    resizeObserverCallback = null;
    vi.stubGlobal(
      "ResizeObserver",
      TestResizeObserver as typeof ResizeObserver,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("re-anchors immediately during sidebar expansion when pinned to the right edge", () => {
    const { result, unmount } = renderHook(() => useHorizontalScroll());
    const scroller = createScroller({
      clientWidth: 200,
      scrollWidth: 500,
      scrollLeft: 300,
    });

    act(() => {
      result.current(scroller.element);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("sidebar-transition-start"));
    });

    scroller.setClientWidth(150);

    act(() => {
      triggerResize(150);
    });

    expect(scroller.getScrollLeft()).toBe(350);

    act(() => {
      result.current(null);
    });
    unmount();
    scroller.cleanup();
  });

  it("preserves the user's distance from the right edge during sidebar transitions", () => {
    const { result, unmount } = renderHook(() => useHorizontalScroll());
    const scroller = createScroller({
      clientWidth: 200,
      scrollWidth: 500,
      scrollLeft: 240,
    });

    act(() => {
      result.current(scroller.element);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("sidebar-transition-start"));
    });

    scroller.setClientWidth(150);
    scroller.setScrollWidth(500);

    act(() => {
      triggerResize(150);
    });

    expect(scroller.getScrollLeft()).toBe(290);

    act(() => {
      result.current(null);
    });
    unmount();
    scroller.cleanup();
  });

  it("starts a transition sync loop so width changes are corrected between resize observer ticks", () => {
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    const rafCallbacks: FrameRequestCallback[] = [];

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { result, unmount } = renderHook(() => useHorizontalScroll());
    const scroller = createScroller({
      clientWidth: 200,
      scrollWidth: 500,
      scrollLeft: 300,
    });

    act(() => {
      result.current(scroller.element);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("sidebar-transition-start"));
    });

    expect(rafCallbacks.length).toBeGreaterThan(0);

    scroller.setClientWidth(150);

    act(() => {
      const callback = rafCallbacks.shift();
      callback?.(16);
    });

    expect(scroller.getScrollLeft()).toBe(350);

    act(() => {
      result.current(null);
    });
    unmount();
    scroller.cleanup();

    vi.stubGlobal("requestAnimationFrame", originalRaf);
    vi.stubGlobal("cancelAnimationFrame", originalCancelRaf);
  });
});
