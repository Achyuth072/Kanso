import { useCallback, useRef } from "react";

export function useHorizontalScroll() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const callbackRef = useCallback((el: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!el) return;
    el.style.overflowAnchor = "none";

    let targetScrollLeft = el.scrollLeft;
    let animationId: number | null = null;
    const lerpFactor = 0.25;
    const friction = 0.92; // Inertia decay rate
    let velocity = 0;
    let lastMouseX = 0;
    let lastTime = 0;
    let isMoving = false;
    let totalMoved = 0;

    // Track sidebar transition state and user scrolling
    let isTransitioning = false;
    let distanceFromRightBeforeTransition: number | null = null;
    let transitionSyncFrame: number | null = null;

    // Ignore very early mount resizes while the initial auto-scroll settles.
    // Sidebar transitions bypass this path and are handled explicitly below.
    const mountTime = Date.now();
    const MOUNT_GRACE_PERIOD = 300; // ms to ignore resize events after mount

    // Store original scroll-snap style to restore later
    let originalScrollSnapType: string | null = null;

    const disableScrollSnap = () => {
      if (originalScrollSnapType === null) {
        originalScrollSnapType = el.style.scrollSnapType || "";
        el.style.scrollSnapType = "none";
      }
    };

    const enableScrollSnap = () => {
      if (originalScrollSnapType !== null) {
        el.style.scrollSnapType = originalScrollSnapType;
        originalScrollSnapType = null;
      }
    };

    const update = () => {
      if (!el) return;

      if (isMoving) {
        // Smoothly interpolate to target (used for Wheel)
        const diff = targetScrollLeft - el.scrollLeft;
        if (Math.abs(diff) < 0.2) {
          // Tighter threshold
          el.scrollLeft = targetScrollLeft;
          animationId = null;
          enableScrollSnap();
          velocity = 0;
          el.style.willChange = "auto";
          return;
        }
        el.scrollLeft += diff * lerpFactor;
      } else {
        // Inertia (used for Drag release)
        if (Math.abs(velocity) < 0.1) {
          velocity = 0;
          animationId = null;
          enableScrollSnap();
          el.style.willChange = "auto";
          return;
        }
        el.scrollLeft += velocity;
        velocity *= friction;
        targetScrollLeft = el.scrollLeft;
      }

      animationId = requestAnimationFrame(update);
    };

    const syncTransitionPosition = () => {
      if (!isTransitioning || distanceFromRightBeforeTransition === null) {
        transitionSyncFrame = null;
        return;
      }

      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const newScrollLeft = Math.max(
        0,
        maxScroll - distanceFromRightBeforeTransition,
      );

      if (el.scrollLeft !== newScrollLeft) {
        el.scrollLeft = newScrollLeft;
        targetScrollLeft = newScrollLeft;
      }

      transitionSyncFrame = requestAnimationFrame(syncTransitionPosition);
    };

    const onScroll = () => {
      if (animationId === null) {
        targetScrollLeft = el.scrollLeft;
      }
    };

    const onWheel = (e: WheelEvent) => {
      // Horizontal swipe on trackpad or tilt wheel: let native handle it.
      // This allows the system's native horizontal inertia to work perfectly.
      if (Math.abs(e.deltaX) > 0) {
        if (animationId !== null) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
        isMoving = false;
        enableScrollSnap();
        return; // Do not preventDefault
      }

      if (e.deltaY === 0) return;

      const isScrollable = el.scrollWidth > el.clientWidth;
      if (!isScrollable) return;

      disableScrollSnap();
      isMoving = true;
      el.style.willChange = "scroll-position";

      if (animationId === null) {
        targetScrollLeft = el.scrollLeft;
      }

      targetScrollLeft = Math.max(
        0,
        Math.min(el.scrollWidth - el.clientWidth, targetScrollLeft + e.deltaY),
      );

      e.preventDefault();

      if (animationId === null) {
        animationId = requestAnimationFrame(update);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);

      // Keep the exact pre-transition distance from the right edge in sync with
      // the sidebar width animation, instead of waiting for the next frame.
      if (isTransitioning && distanceFromRightBeforeTransition !== null) {
        const newScrollLeft = Math.max(
          0,
          maxScrollLeft - distanceFromRightBeforeTransition,
        );
        el.scrollLeft = newScrollLeft;
        targetScrollLeft = newScrollLeft;
        return;
      }

      if (isTransitioning) return;

      const timeSinceMount = Date.now() - mountTime;
      if (timeSinceMount < MOUNT_GRACE_PERIOD) {
        return;
      }

      // Outside sidebar transitions, only clamp within bounds.
      targetScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
    });

    // Mouse Drag Support
    let isDown = false;
    let startX: number;
    let scrollLeftStart: number;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      el.classList.add("cursor-grabbing");
      startX = e.pageX - el.offsetLeft;
      scrollLeftStart = el.scrollLeft;
      totalMoved = 0;
      velocity = 0;
      lastMouseX = e.pageX;
      lastTime = performance.now();
      isMoving = false;
      el.style.willChange = "scroll-position";

      disableScrollSnap();

      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    const stopDragging = () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("cursor-grabbing");

      if (Math.abs(velocity) > 2) {
        // Trigger inertia
        isMoving = false;
        animationId = requestAnimationFrame(update);
      } else {
        enableScrollSnap();
      }
    };

    const onMouseLeave = stopDragging;
    const onMouseUp = stopDragging;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;

      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      const prevScrollLeft = el.scrollLeft;

      el.scrollLeft = scrollLeftStart - walk;
      targetScrollLeft = el.scrollLeft;

      // Calculate velocity
      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) {
        const dx = el.scrollLeft - prevScrollLeft;
        velocity = dx; // Simple frame velocity
        lastTime = now;
      }

      totalMoved += Math.abs(x - (lastMouseX - el.offsetLeft));
      lastMouseX = e.pageX;

      e.preventDefault();
    };

    // Prevent click if we moved significantly
    const onClick = (e: MouseEvent) => {
      if (totalMoved > 10) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll);
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("click", onClick, { capture: true });

    resizeObserver.observe(el);

    const onSidebarTransitionStart = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      distanceFromRightBeforeTransition = maxScroll - el.scrollLeft;
      isTransitioning = true;

      if (transitionSyncFrame === null) {
        transitionSyncFrame = requestAnimationFrame(syncTransitionPosition);
      }
    };

    const onSidebarTransitionEnd = () => {
      isTransitioning = false;
      if (transitionSyncFrame !== null) {
        cancelAnimationFrame(transitionSyncFrame);
        transitionSyncFrame = null;
      }
      if (distanceFromRightBeforeTransition !== null) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        const newScrollLeft = Math.max(
          0,
          maxScroll - distanceFromRightBeforeTransition,
        );
        el.scrollLeft = newScrollLeft;
        targetScrollLeft = newScrollLeft;
        // distance from right handled below
        distanceFromRightBeforeTransition = null;
      }
    };

    window.addEventListener(
      "sidebar-transition-start",
      onSidebarTransitionStart,
    );
    window.addEventListener("sidebar-transition-end", onSidebarTransitionEnd);

    cleanupRef.current = () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener(
        "sidebar-transition-start",
        onSidebarTransitionStart,
      );
      window.removeEventListener(
        "sidebar-transition-end",
        onSidebarTransitionEnd,
      );
      resizeObserver.disconnect();
      enableScrollSnap();
      if (animationId !== null) cancelAnimationFrame(animationId);
      if (transitionSyncFrame !== null)
        cancelAnimationFrame(transitionSyncFrame);
    };
  }, []);

  return callbackRef;
}
