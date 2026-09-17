import { createElement, type MouseEvent, type ReactNode } from "react";

type MaterialIconButtonProps = {
  icon: ReactNode;
  variant?: "standard" | "filled";
  className?: string;
  title?: string;
  ariaLabel?: string;
  ariaControls?: string;
  ariaHasPopup?: boolean | "menu" | "listbox" | "tree" | "grid" | "dialog";
  ariaExpanded?: boolean;
  badge?: ReactNode;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
};

/**
 * Small React bridge for Material Web's icon buttons. Keeping this wrapper
 * local means the chat can use real md-* elements while retaining a graceful
 * CSS/Lucide fallback in a WebView that cannot load the CDN module.
 */
const MaterialIconButton = ({
  icon,
  variant = "standard",
  className,
  title,
  ariaLabel,
  ariaControls,
  ariaHasPopup,
  ariaExpanded,
  badge,
  disabled,
  onClick,
}: MaterialIconButtonProps) => {
  const elementName = variant === "filled" ? "md-filled-icon-button" : "md-icon-button";

  return createElement(
    elementName,
    {
      className: `material-chat-icon-button ${className ?? ""}`.trim(),
      title,
      "aria-label": ariaLabel,
      "aria-controls": ariaControls,
      "aria-haspopup": ariaHasPopup,
      "aria-expanded": ariaExpanded,
      "data-badge": typeof badge === "string" || typeof badge === "number" ? String(badge) : undefined,
      disabled,
      onClick,
    },
    createElement("span", { slot: "icon", className: "material-chat-icon-fallback" }, icon),
  );
};

export default MaterialIconButton;