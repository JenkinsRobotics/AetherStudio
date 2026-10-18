import { createApplicationStatusBar, updateApplicationStatusBar } from "@aether/ui/application-status";
import "@aether/ui/application-status.css";
import "./account-layout.css";

// One host-backed account control for every Aether front end.
let account = null;
let connectionState = "connecting";
let companyName = "";
let applicationName = null;
const subscribers = new Set();
async function request(path, body) {
  const response = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to update your account.");
  return data;
}
// Appearance (System/Light/Dark) is a device preference, separate from the
// account's theme package. This module is injected into every Aether page's
// head, so it is also the bootstrap: the right mode is on screen before any
// React app mounts. @aether/ui's AppearanceToggle reads the same key and
// listens for the event below, so the two controls never disagree.
const APPEARANCE_KEY = "aether-appearance";
const APPEARANCE = ["system", "light", "dark"];
const APPEARANCE_LABEL = {
  system: "Follow system theme",
  light: "Light",
  dark: "Dark",
};
function storedAppearance() {
  try {
    const saved = localStorage.getItem(APPEARANCE_KEY);
    return APPEARANCE.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}
function applyAppearance(mode) {
  const prefersLight =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: light)").matches;
  document.documentElement.classList.toggle(
    "aether-light-theme",
    mode === "light" || (mode === "system" && prefersLight),
  );
  document.documentElement.dataset.appearance = mode;
}
function setAppearance(mode) {
  try {
    localStorage.setItem(APPEARANCE_KEY, mode);
  } catch {
    /* device preference only */
  }
  applyAppearance(mode);
  document.dispatchEvent(new CustomEvent("aether-appearance", { detail: mode }));
}
applyAppearance(storedAppearance());
document.addEventListener("aether-appearance", apply);
if (typeof matchMedia === "function")
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () =>
    applyAppearance(storedAppearance()),
  );

// Shared interface icons, inlined so they inherit currentColor. Fetched once;
// the widget re-renders when they land and falls back to text-only until then.
const glyphs = {};
Promise.all(
  ["settings"].map(async (name) => {
    try {
      const response = await fetch("/suite/icons/" + name + ".svg");
      if (response.ok) glyphs[name] = await response.text();
    } catch {
      /* the control stays usable without its glyph */
    }
  }),
).then(() => apply());

let workspaceTheme = null;
function applyTheme() {
  // The shared UI's explicit browser choice takes precedence over host defaults.
  // Publish the host fallback so UI controls and bootstrap resolve the same theme.
  const scope = document.querySelector('meta[name="aether-app"]')?.content || "studio";
  const personal = account && account.theme_id && account.theme_id.trim();
  const fallback =
    personal ||
    (workspaceTheme && (workspaceTheme.apps?.[scope] || workspaceTheme.base)) ||
    "aether-default";
  const root = document.documentElement;
  const previousFallback = root.dataset.aetherHostTheme;
  root.dataset.aetherHostTheme = fallback;
  let effective = fallback;
  try { effective = localStorage.getItem("aether-theme") || fallback; } catch { /* host fallback without browser storage */ }
  for (const name of Array.from(root.classList))
    if (name.startsWith("aether-theme-")) root.classList.remove(name);
  if (effective !== "aether-default")
    root.classList.add("aether-theme-" + effective);
  if (previousFallback !== fallback)
    document.dispatchEvent(new CustomEvent("aether-theme", { detail: effective }));
}
document.addEventListener("aether-theme", applyTheme);
window.addEventListener("storage", (event) => {
  if (event.key === "aether-theme" || event.key === null) applyTheme();
});
function apply() {
  applyTheme();
  renderStatusRow();
  for (const update of subscribers) update();
}
async function refresh() {
  try {
    const status = await request("/api/status");
    account = status.user;
    companyName = typeof status.name === "string" ? status.name : "";
    connectionState = "connected";
    const app = document.querySelector('meta[name="aether-app"]')?.content;
    applicationName = status.apps?.find(item => item.id === app)?.name || null;
    workspaceTheme = status.theme || null;
    apply();
    document.dispatchEvent(
      new CustomEvent("aether-account", { detail: account }),
    );
  } catch {
    connectionState = "offline";
    apply();
  }
}
const channel =
  typeof BroadcastChannel === "function"
    ? new BroadcastChannel("aether-account")
    : null;
channel?.addEventListener("message", refresh);
window.addEventListener("focus", refresh);
document.addEventListener("aether-account-refresh", () => {
  refresh();
  channel?.postMessage("changed");
});
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function avatarFor(className) {
  const name = account.full_name || account.username;
  const node = account.avatar ? element("img") : element("span", name.slice(0, 1).toUpperCase());
  node.className = className;
  if (account.avatar) {
    node.src = account.avatar;
    node.alt = "";
  }
  return node;
}
class AetherAccount extends HTMLElement {
  connectedCallback() {
    this.update = () => this.render();
    subscribers.add(this.update);
    this.render();
  }
  disconnectedCallback() {
    subscribers.delete(this.update);
  }
  render() {
    this.replaceChildren();
    if (!account) return;
    if (this.closest('[data-aether-account-layout="sidebar"]')) this.append(this.identity(), this.settings());
    else this.append(this.settings(), this.identity());
  }
  /** Gear menu: the suite-wide app settings every front end shares. Theme is
   *  the one setting that exists everywhere; "Settings" hands off to the app's
   *  own SettingsWindow when it listens, and falls back to Studio settings. */
  settings() {
    const details = element("details", "", "suite-settings");
    const summary = element("summary");
    summary.setAttribute("aria-label", "Settings");
    summary.title = "Settings";
    if (glyphs.settings) summary.innerHTML = glyphs.settings;
    else summary.textContent = "Settings";
    const menu = element("div", "", "suite-settings-menu");
    const row = element("label", "", "suite-settings-row");
    row.append(element("span", "Theme"));
    const select = element("select");
    for (const mode of APPEARANCE) {
      const option = element("option", APPEARANCE_LABEL[mode]);
      option.value = mode;
      select.append(option);
    }
    select.value = storedAppearance();
    select.onchange = () => setAppearance(select.value);
    row.append(select);
    menu.append(row, element("div", "", "suite-account-separator"));
    const open = element("button", "Settings", "suite-account-item");
    open.type = "button";
    open.onclick = () => {
      // An app with its own settings window claims this by calling
      // preventDefault(); otherwise Studio's settings page answers.
      const ask = new CustomEvent("aether-open-settings", { cancelable: true });
      if (document.dispatchEvent(ask)) location.assign("/?account=1");
      details.open = false;
    };
    menu.append(open);
    details.append(summary, menu);
    return details;
  }
  identity() {
    const details = element("details", "", "suite-account");
    const summary = element("summary");
    const name = account.full_name || account.username;
    summary.setAttribute("aria-label", "Account: " + name);
    summary.append(avatarFor("suite-avatar"));
    if (this.closest('[data-aether-account-layout="sidebar"]')) {
      const label = element("span", "", "suite-account-caption");
      label.append(element("strong", name), element("small", account.email || account.username));
      summary.append(label);
      summary.title = name;
    }
    const menu = element("div", "", "suite-account-menu");
    const top = element("div", "", "suite-account-top");
    const home = element("a", "Aether Studio", "suite-account-brand");
    home.href = "/";
    const error = element("p");
    error.setAttribute("role", "alert");
    const logout = element("button", "Sign out", "suite-account-signout");
    logout.type = "button";
    logout.onclick = async () => {
      try {
        await request("/api/logout", {});
        channel?.postMessage("changed");
        location.assign(
          "/?next=" + encodeURIComponent(location.pathname + location.search),
        );
      } catch (e) {
        error.textContent = e.message;
      }
    };
    top.append(home, logout);
    const identity = element("div", "", "suite-account-identity");
    identity.append(
      avatarFor("suite-avatar suite-avatar-large"),
      element("strong", name),
      element("small", account.email || account.username),
    );
    const view = element("button", "View account", "suite-account-link");
    view.type = "button";
    view.onclick = () => location.assign("/?account=1");
    identity.append(view);
    const agent = element("button", "Aether Agent", "suite-account-link");
    agent.type = "button";
    agent.onclick = () => {
      details.open = false;
      const requestOpen = new CustomEvent("aether-agent-open", { cancelable: true });
      if (!window.dispatchEvent(requestOpen)) return;
      // Prefer an application's existing shared agent rail, preserving its context.
      const workspaceAgent = document.querySelector('button[aria-label="Aether Agent"]');
      if (workspaceAgent) {
        if (workspaceAgent.getAttribute("aria-pressed") !== "true") workspaceAgent.click();
        document.querySelector('[aria-label="Ask Aether Agent"]')?.focus();
        return;
      }
      const scope = location.pathname.split("/")[1];
      if (!["cad", "map", "animation", "sketch", "vector", "ui"].includes(scope)) {
        location.assign("/?plugins"); return;
      }
      document.querySelector(".suite-agent-drawer")?.remove();
      const drawer = element("aside", "", "suite-agent-drawer");
      drawer.setAttribute("aria-label", "Aether Agent");
      const heading = element("header", "Aether Agent");
      const close = element("button", "Close");
      close.setAttribute("aria-label", "Close Aether Agent");
      close.onclick = () => { drawer.remove(); summary.focus(); };
      heading.append(close);
      const frame = element("iframe");
      frame.title = "Aether Agent workspace";
      frame.src = "/?agent=" + encodeURIComponent(scope);
      drawer.append(heading, frame);
      document.body.append(drawer);
      close.focus();
    };
    identity.append(agent);
    menu.append(top, identity, error);
    details.append(summary, menu);
    return details;
  }
}
customElements.define("aether-account", AetherAccount);
// Place this shared control in front-end-owned slots after React mounts.
const mount = () =>
  document.querySelectorAll("[data-aether-account]").forEach((slot) => {
    if (!slot.querySelector("aether-account"))
      slot.append(document.createElement("aether-account"));
  });
new MutationObserver(mount).observe(document.body, {
  childList: true,
  subtree: true,
});
mount();
refresh();


// Hosted application chrome is shared across every product, outside React roots.
function renderStatusRow() {
  const app = document.querySelector('meta[name="aether-app"]')?.content;
  if (!app || !document.body) return;
  const names = { cad: 'Aether CAD', map: 'Aether Map', io: 'Aether IO', animation: 'Aether Animation', sketch: 'Aether Sketch', vector: 'Aether Vector', drive: 'Aether Drive', studio: 'Aether Studio' };
  const name = applicationName || names[app] || 'Aether Studio';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const label = connectionState === 'connected' ? (local ? 'Connected · Local Studio' : 'Connected · Studio server')
    : connectionState === 'offline' ? 'Studio unavailable' : 'Connecting to Studio…';
  const props = { appName: name, companyName, connection: connectionState, connectionLabel: label };
  let row = document.querySelector('.suite-status-row');
  if (!row) {
    row = createApplicationStatusBar(props);
    row.classList.add('suite-status-row');
    document.body.append(row);
    document.body.classList.add('suite-has-status-row');
  } else updateApplicationStatusBar(row, props);
}
renderStatusRow();
window.addEventListener('offline', () => { connectionState = 'offline'; renderStatusRow(); });
window.addEventListener('online', refresh);
setInterval(() => { if (!document.hidden) refresh(); }, 30000);
