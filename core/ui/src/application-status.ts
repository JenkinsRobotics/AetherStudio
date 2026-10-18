/** Presentation only. The application/session adapter supplies confirmed state. */
export type ApplicationConnection = "connecting" | "connected" | "offline" | "local";

export interface ApplicationStatusProps {
  appName: string;
  companyName?: string;
  connection: ApplicationConnection;
  connectionLabel?: string;
  message?: string;
}

const connectionLabels: Record<ApplicationConnection, string> = {
  connecting: "Connecting to Studio…",
  connected: "Connected to Studio",
  offline: "Studio unavailable",
  local: "Local workspace",
};

function text(node: Element, value: string) {
  if (node.textContent !== value) node.textContent = value;
}

/** The single DOM renderer shared by React and the pre-React hosted bootstrap. */
export function updateApplicationStatusBar(row: HTMLElement, props: ApplicationStatusProps) {
  row.classList.add("aui-application-status");
  row.setAttribute("aria-label", "Application status");
  row.dataset.connection = props.connection;
  if (!row.querySelector(".aui-application-status__identity")) {
    const node = (tag: string, className: string) => {
      const child = row.ownerDocument.createElement(tag);
      child.className = `aui-application-status__${className}`;
      return child;
    };
    const identity = node("span", "identity");
    const connection = node("span", "connection");
    connection.setAttribute("role", "status");
    connection.setAttribute("aria-atomic", "true");
    const dot = node("span", "dot");
    dot.setAttribute("aria-hidden", "true");
    connection.append(dot, node("span", "connection-label"));
    identity.append(connection, node("strong", "name"));
    row.append(identity, node("span", "message"), node("span", "company"));
  }
  const label = props.connectionLabel || connectionLabels[props.connection];
  const find = (name: string) => row.querySelector<HTMLElement>(`.aui-application-status__${name}`)!;
  find("connection").title = label;
  text(find("connection-label"), label);
  text(find("name"), props.appName);
  find("name").title = props.appName;
  text(find("company"), props.companyName?.trim() || "");
  find("company").title = props.companyName?.trim() || "";
  // Outages remain visibly explained, even when there is no application message.
  text(find("message"), props.connection === "offline" ? label : props.message || "");
}

export function createApplicationStatusBar(props: ApplicationStatusProps, owner: Document = document) {
  const row = owner.createElement("footer");
  updateApplicationStatusBar(row, props);
  return row;
}
