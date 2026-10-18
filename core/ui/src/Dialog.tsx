import { useEffect, useRef } from "react";
import { AetherIcon } from "./AetherIcon";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  /** Show the same window in document flow, without a scrim or modal focus behavior. */
  inline?: boolean;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal dialog with scrim. Escape or scrim click closes; focus moves
 *  into the dialog on open, Tab cycles within it, and focus returns to
 *  the opener on close. */
export function Dialog({ open, title, onClose, actions, children, inline = false }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  /* Held in a ref so the effect below depends on `open` alone.
     Every caller passes an inline arrow for `onClose`, so listing it as a
     dependency re-ran this effect on each render: the cleanup handed focus
     back to the opener and the setup moved it to the first focusable element.
     With a dialog open that meant one keystroke emptied the caret out of the
     field, which is the "deselects after every letter" Jonathan reported on
     2026-10-03. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || inline) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    /* Prefer what the content asked for. Focusing the first focusable put the
       caret on the title bar's close button, so a dialog whose job is to take
       a name opened with the wrong thing focused. */
    const wanted =
      dialog?.querySelector<HTMLElement>("[autofocus]") ??
      dialog?.querySelector<HTMLElement>(".aui-dialog-body " + FOCUSABLE.split(", ").join(", .aui-dialog-body ")) ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE);
    wanted?.focus();

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !dialog.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (current === last || !dialog.contains(current))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [open, inline]);

  if (!open) return null;
  return (
    <div
      className={`aui-dialog-scrim${inline ? " aui-dialog-scrim--inline" : ""}`}
      onClick={(event) => {
        if (!inline && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="aui-dialog"
        role="dialog"
        aria-modal={!inline}
        aria-label={title}
      >
        <div className="aui-dialog-title">
          <span>{title}</span>
          <button
            type="button"
            className="aui-icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            <AetherIcon name="close" />
          </button>
        </div>
        <div className="aui-dialog-body">{children}</div>
        {actions ? <div className="aui-dialog-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
