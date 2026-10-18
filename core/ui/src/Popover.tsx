import { createPortal } from "react-dom";
import { useOverlayHost } from "./OverlayScope";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  useOverlayPosition,
  type OverlayAnchor,
  type OverlayPlacement,
} from "./overlay-position";

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export interface PopoverProps {
  open: boolean;
  anchor: OverlayAnchor | null;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
  placement?: OverlayPlacement;
  /** `first` is useful for small editors; `none` preserves viewport focus. */
  focus?: "none" | "first";
  closeOnOutsidePress?: boolean;
  returnFocus?: boolean;
  className?: string;
  /** Show the shared surface in document flow; no anchor, portal or dismissal listeners. */
  inline?: boolean;
}

/** Anchored nonmodal surface shared by compact editors and explanatory cards. */
export function Popover({
  open,
  anchor,
  onClose,
  children,
  ariaLabel,
  placement = "bottom-start",
  focus = "none",
  closeOnOutsidePress = true,
  returnFocus = true,
  className,
  inline = false,
}: PopoverProps) {
  const overlayHost = useOverlayHost();
  const popoverRef = useRef<HTMLDivElement>(null);
  const position = useOverlayPosition({
    open: open && !inline,
    overlayRef: popoverRef,
    anchor,
    placement,
  });

  useEffect(() => {
    if (!open || inline) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!closeOnOutsidePress) return;
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchor instanceof HTMLElement && anchor.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      if (returnFocus) opener?.focus?.();
    };
  }, [anchor, closeOnOutsidePress, focus, onClose, open, returnFocus, inline]);

  // Positioning initially hides the portal while measuring it. A browser cannot
  // focus a visibility:hidden item (jsdom can), so wait for visible placement.
  useEffect(() => {
    if (open && !inline && focus === "first" && position.visibility === "visible") {
      popoverRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
  }, [open, focus, position.visibility, inline]);

  if (!open || (!inline && !anchor) || typeof document === "undefined") return null;
  const classes = ["aui-popover"];
  if (className) classes.push(className);
  if (inline) classes.push("aui-popover--inline");
  const surface = (
    <div
      ref={popoverRef}
      className={classes.join(" ")}
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
      style={inline ? undefined : position}
    >
      {children}
    </div>
  );
  return inline ? surface : createPortal(surface, overlayHost ?? document.body);
}
