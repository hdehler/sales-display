import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ROW_1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const ROW_2 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW_3 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW_4 = ["z", "x", "c", "v", "b", "n", "m"];

function isTextInput(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const t = el.type;
    return t === "text" || t === "search" || t === "number" || t === "email" || t === "url" || t === "";
  }
  return false;
}

export function VirtualKeyboard() {
  const [visible, setVisible] = useState(false);
  const [shifted, setShifted] = useState(false);
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const kbRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const show = useCallback((el: HTMLInputElement | HTMLTextAreaElement) => {
    clearHideTimer();
    activeRef.current = el;
    setVisible(true);
  }, [clearHideTimer]);

  const hide = useCallback(() => {
    setVisible(false);
    activeRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      const active = document.activeElement;
      if (kbRef.current?.contains(active)) return;
      if (isTextInput(active)) return;
      hide();
    }, 250);
  }, [clearHideTimer, hide]);

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (isTextInput(e.target)) {
        show(e.target);
      }
    }

    function onFocusOut(e: FocusEvent) {
      const related = e.relatedTarget as HTMLElement | null;
      if (related && kbRef.current?.contains(related)) return;
      scheduleHide();
    }

    // Touch/click fallback: on some Electron/Pi setups, focusin doesn't fire
    // reliably on touch. Catching pointerdown on capture ensures we see it.
    function onPointerDown(e: PointerEvent) {
      if (isTextInput(e.target)) {
        // Small delay to let the browser set focus first
        setTimeout(() => {
          if (isTextInput(document.activeElement)) {
            show(document.activeElement);
          }
        }, 50);
      }
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [show, scheduleHide]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  function emitInput(el: HTMLInputElement | HTMLTextAreaElement, newValue: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function press(key: string) {
    const el = activeRef.current;
    if (!el) return;
    el.focus();

    const char = shifted ? key.toUpperCase() : key;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + char + el.value.slice(end);
    emitInput(el, next);
    const cursor = start + 1;
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
    if (shifted) setShifted(false);
  }

  function backspace() {
    const el = activeRef.current;
    if (!el) return;
    el.focus();

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start === end && start > 0) {
      const next = el.value.slice(0, start - 1) + el.value.slice(end);
      emitInput(el, next);
      requestAnimationFrame(() => el.setSelectionRange(start - 1, start - 1));
    } else if (start !== end) {
      const next = el.value.slice(0, start) + el.value.slice(end);
      emitInput(el, next);
      requestAnimationFrame(() => el.setSelectionRange(start, start));
    }
  }

  function space() {
    press(" ");
  }

  function enter() {
    const el = activeRef.current;
    if (!el) return;
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    hide();
  }

  function dismiss() {
    activeRef.current?.blur();
    hide();
  }

  const btnBase =
    "flex items-center justify-center rounded-lg font-medium transition-all active:scale-95 select-none touch-manipulation";
  const charBtn = `${btnBase} bg-surface-raised border border-border text-text-primary text-lg h-12 min-w-[2.4rem]`;
  const specialBtn = `${btnBase} bg-surface-hover border border-border text-text-secondary text-sm h-12 px-4`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={kbRef}
          className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0f1117] border-t border-border-bright shadow-2xl"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", bounce: 0.1, duration: 0.35 }}
          onPointerDown={(e) => {
            e.preventDefault();
            clearHideTimer();
          }}
        >
          <div className="max-w-3xl mx-auto px-3 py-3 space-y-2">
            {/* Row 1 — numbers */}
            <div className="flex gap-1.5 justify-center">
              {ROW_1.map((k) => (
                <button key={k} className={charBtn} onClick={() => press(k)} style={{ flex: 1 }}>
                  {k}
                </button>
              ))}
            </div>

            {/* Row 2 */}
            <div className="flex gap-1.5 justify-center">
              {ROW_2.map((k) => (
                <button key={k} className={charBtn} onClick={() => press(k)} style={{ flex: 1 }}>
                  {shifted ? k.toUpperCase() : k}
                </button>
              ))}
            </div>

            {/* Row 3 */}
            <div className="flex gap-1.5 justify-center px-4">
              {ROW_3.map((k) => (
                <button key={k} className={charBtn} onClick={() => press(k)} style={{ flex: 1 }}>
                  {shifted ? k.toUpperCase() : k}
                </button>
              ))}
            </div>

            {/* Row 4 — shift + letters + backspace */}
            <div className="flex gap-1.5 justify-center">
              <button
                className={`${specialBtn} ${shifted ? "!bg-accent !text-on-accent !border-accent" : ""}`}
                onClick={() => setShifted(!shifted)}
                style={{ flex: 1.5 }}
              >
                ⇧
              </button>
              {ROW_4.map((k) => (
                <button key={k} className={charBtn} onClick={() => press(k)} style={{ flex: 1 }}>
                  {shifted ? k.toUpperCase() : k}
                </button>
              ))}
              <button className={specialBtn} onClick={backspace} style={{ flex: 1.5 }}>
                ⌫
              </button>
            </div>

            {/* Row 5 — special keys + space */}
            <div className="flex gap-1.5 justify-center">
              <button className={specialBtn} onClick={() => press(".")} style={{ flex: 1 }}>
                .
              </button>
              <button className={specialBtn} onClick={() => press("@")} style={{ flex: 1 }}>
                @
              </button>
              <button className={specialBtn} onClick={() => press("-")} style={{ flex: 1 }}>
                -
              </button>
              <button
                className={`${btnBase} bg-surface-raised border border-border text-text-primary text-base h-12`}
                onClick={space}
                style={{ flex: 5 }}
              >
                space
              </button>
              <button className={specialBtn} onClick={enter} style={{ flex: 1.5 }}>
                ↵
              </button>
              <button className={specialBtn} onClick={dismiss} style={{ flex: 1.5 }}>
                Done
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
