import helpIcon from "@aether/assets/icons/help.svg?raw";

/** Retained metadata for callers; the accessory row never renders help content. */
export interface FeatureWindowHelp {
  summary: string;
  steps?: readonly string[];
}

/** Shared icon-control row. Toggling an accessory never changes the editor's
 * structure, opens content, moves focus, or submits/discards the feature. */
export function createFeatureWindowAccessories(options: {
  title: string;
  help?: FeatureWindowHelp;
  helpActive?: boolean;
  onHelpToggle?: (active: boolean) => void;
}) {
  const element = document.createElement("div");
  element.className = "aui-feature-accessories";
  const footer = document.createElement("div");
  footer.className = "aui-feature-footer";
  footer.setAttribute("role", "group");
  footer.setAttribute("aria-label", "Feature accessories");
  const button = (iconSvg: string, title: string, onToggle: (active: boolean) => void, active = false) => {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "aui-feature-action-icon";
    action.title = title;
    action.setAttribute("aria-label", title);
    action.setAttribute("aria-pressed", String(active));
    action.innerHTML = iconSvg;
    for (const svg of action.querySelectorAll("svg")) {
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
    }
    action.onclick = () => {
      const next = action.getAttribute("aria-pressed") !== "true";
      action.setAttribute("aria-pressed", String(next));
      onToggle(next);
    };
    return action;
  };
  const helpButton = button(helpIcon, "Help", active => options.onHelpToggle?.(active), options.helpActive);
  const setHelpActive = (active: boolean) => helpButton.setAttribute("aria-pressed", String(active));
  footer.append(helpButton);
  element.append(footer);
  element.addEventListener("keydown", event => {
    // Native Enter/Space activation still works, without reaching editor shortcuts.
    if (event.key === "Enter" || event.key === " " || event.key === "Escape") event.stopPropagation();
    if (event.key === "Escape" && helpButton.getAttribute("aria-pressed") === "true") {
      event.preventDefault();
      setHelpActive(false);
      options.onHelpToggle?.(false);
    }
  });
  return {
    element,
    /** Synchronize app-owned state without firing the user-toggle callback. */
    setHelpActive,
    actionIcon(iconSvg: string, title: string, onToggle: (active: boolean) => void, active = false) {
      const action = button(iconSvg, title, onToggle, active);
      footer.insertBefore(action, helpButton);
      return action;
    },
  };
}
