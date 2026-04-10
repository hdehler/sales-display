import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ROW_1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const ROW_2 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW_3 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW_4 = ["z", "x", "c", "v", "b", "n", "m"];

export function VirtualKeyboard() {
  const [visible, setVisible] = useState(false);
  const [shifted, setShifted] = useState(false);
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const kbRef = useRef<HTMLDivElement>(null);

  const show = useCallback((el: HTMLInputElement | HTMLTextAreaElement) => {
    activeRef.current = el;
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    activeRef.current = null;
  }, []);

  useEffect(() => {
    function onFocus(e: FocusEvent) {
      const t = e.target as HTMLElement;
      if (
        t instanceof HTMLInputElement &&
        (t.type === "text" || t.type === "search" || t.type === "number" || t.type === "email" || t.type === "url")
      ) {
        show(t);
      } else if (t instanceof HTMLTextAreaElement) {
        show(t);
      }
    }

    function onBlur(e: FocusEvent) {
      const related = e.relatedTarget as HTMLElement | null;
      if (related && kbRef.current?.contains(related)) return;
      setTimeout(() => {
        if (!kbRef.current?.contains(document.activeElement)) {
          hide();
        }
      }, 100);
    }

    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, [show, hide]);

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
  const charBtn = `${btnBase} bg-surface-raised border border-border text-white text-lg h-12 min-w-[2.4rem]`;
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
          onPointerDown={(e) => e.preventDefault()}
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
                className={`${specialBtn} ${shifted ? "!bg-accent !text-surface !border-accent" : ""}`}
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
                className={`${btnBase} bg-surface-raised border border-border text-white text-base h-12`}
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
