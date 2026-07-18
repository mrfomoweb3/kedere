import { useEffect, type ReactNode } from "react";
import { useLenis } from "../lib/smoothScroll";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const lenis = useLenis();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Freeze background smooth-scroll while the dialog is up.
    lenis?.stop();
    return () => {
      window.removeEventListener("keydown", onKey);
      lenis?.start();
    };
  }, [open, onClose, lenis]);

  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
