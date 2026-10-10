import { useEffect, useRef, type RefObject } from "react";

// The keyboard half of a modal dialog (Lab 4 AC-30, FR-31, ui-spec §9): focus goes in when it opens,
// Tab and Shift+Tab go round inside it and never out to the page behind, Escape closes it, and focus
// goes back to the control that opened it. A dialog that does less is one a keyboard user cannot
// leave, or cannot find their place after.
//
// Call it from the component that is mounted only while the dialog is open: it acts when that
// component mounts and undoes itself when it unmounts.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalOptions {
  /** Called on Escape. It decides whether to close: a dialog with a request in flight keeps itself open. */
  onEscape: () => void;
  /** Where focus goes on close when the control that opened the dialog is no longer on the page. */
  restoreFocusTo?: () => HTMLElement | null;
}

export function useModal(dialog: RefObject<HTMLElement>, { onEscape, restoreFocusTo }: ModalOptions) {
  // The latest callbacks, without running the effect again each time the dialog re-renders.
  const escape = useRef(onEscape);
  escape.current = onEscape;
  const restore = useRef(restoreFocusTo);
  restore.current = restoreFocusTo;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => !item.hidden && !item.closest('[hidden], [aria-hidden="true"]'));

    (items()[0] ?? element).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        escape.current();
        return;
      }
      if (event.key !== "Tab") return;
      const inside = items();
      if (inside.length === 0) {
        event.preventDefault();
        element!.focus();
        return;
      }
      const first = inside[0];
      const last = inside[inside.length - 1];
      const active = document.activeElement;
      if (!element!.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === element)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = opener && opener.isConnected ? opener : (restore.current?.() ?? null);
      target?.focus();
    };
  }, [dialog]);
}
