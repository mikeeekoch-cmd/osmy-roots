import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Portals keep large photographs and PDFs outside transformed/scrolling drawers. */
export function Modal({ label, className = "", onClose, children }: {
  label: string; className?: string; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onClose);
  dismiss.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); dismiss.current();
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled]), summary, iframe, [tabindex="0"]') || [])].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!dialog.current?.contains(document.activeElement) || event.shiftKey && document.activeElement === first) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", keydown, true);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return createPortal(<div className="roots-app modal-root"><div ref={dialog} role="dialog" aria-modal="true" aria-label={label} className={className} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>{children}</div></div>, document.body);
}
