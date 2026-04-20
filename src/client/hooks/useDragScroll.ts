import { useEffect } from "react";

/**
 * Global drag-to-scroll. Listens once on `document` and, on pointerdown,
 * walks up to the nearest scrollable ancestor (anything with
 * `.touch-scroll-y`, or any element with `overflow:auto/scroll`) and drives
 * its scrollTop/scrollLeft as the pointer moves.
 *
 * Why we need this: many touch displays (Pi kiosks, cheap touchscreen
 * monitors) emulate mouse events for finger input. In that case the
 * browser never produces real touch events, so `touch-action: pan-y` is a
 * no-op and the only way to scroll is grabbing the (tiny) scrollbar.
 * Pointer Events unify mouse + touch + pen, so this works everywhere.
 *
 * Mount once near the root of the app via `useGlobalDragScroll()`.
 */
export function useGlobalDragScroll(): void {
  useEffect(() => {
    type ScrollAxis = "y" | "x" | "both";
    interface DragState {
      el: HTMLElement | null;
      axis: ScrollAxis;
      pointerId: number;
      startX: number;
      startY: number;
      startScrollLeft: number;
      startScrollTop: number;
      lastX: number;
      lastY: number;
      lastT: number;
      vX: number;
      vY: number;
      moved: boolean;
      flingRaf: number;
    }

    const state: DragState = {
      el: null,
      axis: "y",
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
    };

    const THRESHOLD = 6; // px before treating as a drag
    const FRICTION = 0.94;
    const STOP = 0.02; // px/ms

    const isInteractive = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          "input, textarea, select, [contenteditable='true'], [data-no-dragscroll]"
        )
      );
    };

    /** Find the nearest scrollable ancestor and the axis it scrolls. */
    const findScroller = (
      start: Element | null
    ): { el: HTMLElement; axis: ScrollAxis } | null => {
      let node: Element | null = start;
      while (node && node !== document.body) {
        if (!(node instanceof HTMLElement)) {
          node = node.parentElement;
          continue;
        }
        // Prefer explicit `.touch-scroll-y` opt-in.
        if (node.classList.contains("touch-scroll-y")) {
          return { el: node, axis: "y" };
        }
        const cs = window.getComputedStyle(node);
        const oy = cs.overflowY;
        const ox = cs.overflowX;
        const scrollableY =
          (oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1;
        const scrollableX =
          (ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth + 1;
        if (scrollableY && scrollableX) return { el: node, axis: "both" };
        if (scrollableY) return { el: node, axis: "y" };
        if (scrollableX) return { el: node, axis: "x" };
        node = node.parentElement;
      }
      // Fall back to the page itself when nothing inside scrolls.
      const root = (document.scrollingElement ||
        document.documentElement) as HTMLElement | null;
      if (root) {
        const pageScrollsY = root.scrollHeight > root.clientHeight + 1;
        const pageScrollsX = root.scrollWidth > root.clientWidth + 1;
        if (pageScrollsY && pageScrollsX) return { el: root, axis: "both" };
        if (pageScrollsY) return { el: root, axis: "y" };
        if (pageScrollsX) return { el: root, axis: "x" };
      }
      return null;
    };

    const cancelFling = () => {
      if (state.flingRaf) {
        cancelAnimationFrame(state.flingRaf);
        state.flingRaf = 0;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      // Left mouse button only; touch and pen always pass.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (isInteractive(e.target)) return;
      const found = findScroller(e.target as Element | null);
      if (!found) return;

      cancelFling();
      state.el = found.el;
      state.axis = found.axis;
      state.pointerId = e.pointerId;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.lastT = performance.now();
      state.vX = 0;
      state.vY = 0;
      state.startScrollLeft = found.el.scrollLeft;
      state.startScrollTop = found.el.scrollTop;
      state.moved = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.el || e.pointerId !== state.pointerId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (!state.moved) {
        const dist =
          state.axis === "x"
            ? Math.abs(dx)
            : state.axis === "y"
            ? Math.abs(dy)
            : Math.hypot(dx, dy);
        if (dist < THRESHOLD) return;
        state.moved = true;
        try {
          state.el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      const now = performance.now();
      const dt = Math.max(1, now - state.lastT);
      state.vX = (e.clientX - state.lastX) / dt;
      state.vY = (e.clientY - state.lastY) / dt;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.lastT = now;

      if (state.axis !== "x") state.el.scrollTop = state.startScrollTop - dy;
      if (state.axis !== "y") state.el.scrollLeft = state.startScrollLeft - dx;

      e.preventDefault();
    };

    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== state.pointerId) return;
      const el = state.el;
      const wasMoved = state.moved;
      const axis = state.axis;
      let { vX, vY } = state;

      try {
        el?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      state.el = null;
      state.pointerId = -1;

      if (!wasMoved || !el) return;

      const step = () => {
        vX *= FRICTION;
        vY *= FRICTION;
        const speed = Math.max(Math.abs(vX), Math.abs(vY));
        if (speed < STOP) {
          state.flingRaf = 0;
          return;
        }
        if (axis !== "x") el.scrollTop -= vY * 16;
        if (axis !== "y") el.scrollLeft -= vX * 16;
        state.flingRaf = requestAnimationFrame(step);
      };
      state.flingRaf = requestAnimationFrame(step);
    };

    // Suppress the synthetic click that fires after a drag so buttons
    // inside scrollers don't activate when the user was just scrolling.
    const onClickCapture = (e: MouseEvent) => {
      if (state.moved) {
        e.stopPropagation();
        e.preventDefault();
        state.moved = false;
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      cancelFling();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);
}
