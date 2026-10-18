import { useLayoutEffect, useRef } from "react";
import { updateApplicationStatusBar, type ApplicationStatusProps } from "./application-status";
import "./ApplicationStatusBar.css";

/** Standard window footer: connection + product left, configured company right. */
export function ApplicationStatusBar(props: ApplicationStatusProps) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (ref.current) updateApplicationStatusBar(ref.current, props);
  }, [props.appName, props.companyName, props.connection, props.connectionLabel, props.message]);
  return <footer ref={ref} />;
}
