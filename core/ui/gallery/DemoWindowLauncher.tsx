import { useRef, useState } from "react";
import { Button, Dialog, TextField } from "../src";
import "./DemoWindowLauncher.css";

export interface DemoWindowTarget { id: string; title: string; url: string; studioOnly?: boolean; }
export function demoWindowURL(url: string) {
  const target = new URL(url, window.location.href);
  target.searchParams.set("presentation", "window");
  return target.href;
}

/** One launcher for all demo directories. Existing windows retain their edits. */
export function useDemoWindowLauncher() {
  const windows = useRef(new Map<string, Window>());
  const [problem, setProblem] = useState<DemoWindowTarget | null>(null);
  const [copied, setCopied] = useState(false);
  const launch = (target: DemoWindowTarget) => {
    setCopied(false);
    if (target.studioOnly) { setProblem(target); return; }
    try {
      const existing = windows.current.get(target.id);
      if (existing && !existing.closed) { existing.focus(); setProblem(null); return; }
      const width = Math.max(640, Math.min(1440, window.screen.availWidth - 64));
      const height = Math.max(480, Math.min(960, window.screen.availHeight - 64));
      const popup = window.open(target.url, `aether-ui-demo-${target.id}`, `popup=yes,width=${width},height=${height},resizable=yes,scrollbars=yes`);
      if (!popup) { setProblem(target); return; }
      popup.opener = null;
      popup.focus();
      windows.current.set(target.id, popup);
      setProblem(null);
    } catch { setProblem(target); }
  };
  const feedback = <Dialog open={!!problem} title={problem?.title ?? "Workspace window"} onClose={() => setProblem(null)} actions={<>
    <Button onClick={() => setProblem(null)}>Done</Button>
    {problem && !problem.studioOnly ? <Button primary onClick={() => launch(problem)}>Try again</Button> : null}
  </>}>
    {problem?.studioOnly ? <><p>This application requires the Studio installation. Open Apps in installed Aether UI to launch it in a workspace window, and sign in if prompted.</p><TextField aria-label="Studio app address" readOnly value={problem.url} onFocus={event => event.target.select()} /><Button onClick={async () => {
      try { await navigator.clipboard.writeText(problem.url); setCopied(true); } catch { setCopied(false); }
    }}>{copied ? "Address copied" : "Copy address"}</Button></> : <p>The browser blocked this workspace window. Allow pop-up windows for this site, then choose Try again.</p>}
  </Dialog>;
  return { launch, feedback };
}
