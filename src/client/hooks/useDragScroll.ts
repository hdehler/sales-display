import { useEffect, useRef, type RefObject } from "react";

/**
 * Drag-to-scroll for any element. Uses Pointer Events so it works for
 * mouse, touch, and pen — including cheap touchscreens / kiosk displays
 * that emulate mouse events for finger input (where `touch-action` CSS is
 * a no-op because the browser never sees a real touch event).
 *
 * Behavior:
 *  - Press anywhere on the element (except on form controls / links) and
 *    drag vertically (and/or horizontally) to scroll the element.
 *  - A small drag threshold prevents stealing taps from buttons inside.
 *  - Inertial fling after release for that iPhone-y feel.
 *
 * Pass `{ axis: "y" }` (default) to lock to vertical, `"x"` for horizontal,
 * or `"both"` to allow either.
 */
export function useDragScroll<T extends HTMLElement>(
  ref: RefObject<T | null>,
  opts: { axis?: "y" | "x" | "both"; enabled?: boolean } = {}
) {
  const { axis = "y", enabled = true } = opts;

  // Persist mutable state across renders without re-binding listeners.
  const stateRef = useRef({
    dragging: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vX: 0,
    vY: 0,
    moved: false,
    flingRaf: 0,
  });

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const THRESHOLD = 6; // px before we treat the gesture as a drag

    const isInteractive = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      // Don't hijack drags that begin on form controls or anchors.
      return Boolean(
        target.closest(
          "input, textarea, select, button, a, [role='button'], [contenteditable='true'], [data-no-dragscroll]"
        )
      );
    };

    const cancelFling = () => {
      const s = stateRef.current;
      if (s.flingRaf) {
        cancelAnimationFrame(s.flingRaf);
        s.flingRaf = 0;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return; // left-click / touch / pen only
      if (isInteractive(e.target)) return;
      cancelFling();
      const s = stateRef.current;
      s.dragging = true;
      s.moved = false;
      s.pointerId = e.pointerId;
      s.startX = e.clientX;
      s.startY = e.clientY;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.lastT = performance.now();
      s.vX = 0;
      s.vY = 0;
      s.startScrollLeft = el.scrollLeft;
      s.startScrollTop = el.scrollTop;
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s.dragging || e.pointerId !== s.pointerId) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;

      if (!s.moved) {
        const dist = axis === "x" ? Math.abs(dx) : axis === "y" ? Math.abs(dy) : Math.hypot(dx, dy);
        if (dist < THRESHOLD) return;
        s.moved = true;
        // Take pointer capture once we know it's a drag so we keep
        // tracking even if the finger leaves the row.
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      // Velocity sample for fling.
      const now = performance.now();
      const dt = Math.max(1, now - s.lastT);
      s.vX = (e.clientX - s.lastX) / dt; // px/ms
      s.vY = (e.clientY - s.lastY) / dt;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.lastT = now;

      if (axis !== "x") el.scrollTop = s.startScrollTop - dy;
      if (axis !== "y") el.scrollLeft = s.startScrollLeft - dx;

      // Block native text selection / native panning while we drive scroll.
      e.preventDefault();
    };

    const endDrag = (e: PointerEvent) => {
      const s = stateRef.current;
      if (e.pointerId !== s.pointerId) return;
      const wasMoved = s.moved;
      s.dragging = false;
      s.pointerId = -1;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!wasMoved) return;

      // Inertial fling. Decay velocity ~95%/frame until tiny.
      const FRICTION = 0.94;
      const STOP = 0.02; // px/ms
      let { vX, vY } = s;
      const step = () => {
        vX *= FRICTION;
        vY *= FRICTION;
        const speed = Math.max(Math.abs(vX), Math.abs(vY));
        if (speed < STOP) {
          s.flingRaf = 0;
          return;
        }
        // ~16ms per frame at 60fps
        if (axis !== "x") el.scrollTop -= vY * 16;
        if (axis !== "y") el.scrollLeft -= vX * 16;
        s.flingRaf = requestAnimationFrame(step);
      };
      s.flingRaf = requestAnimationFrame(step);
    };

    // Suppress click that fires after a drag so buttons inside don't activate.
    const onClickCapture = (e: MouseEvent) => {
      if (stateRef.current.moved) {
        e.stopPropagation();
        e.preventDefault();
        // Reset so next genuine click works.
        stateRef.current.moved = false;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      cancelFling();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [ref, axis, enabled]);
}
