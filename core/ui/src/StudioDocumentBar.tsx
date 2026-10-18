import type { ReactNode } from "react";
import { DocumentBar, type DocumentBarProps } from "./DocumentBar";
import "./StudioAppFrame.css";
import { useStudioDesignDefaults } from "./StudioChrome";
import { MenuButton } from "./Menu";
import { AetherIcon } from "./AetherIcon";

export interface StudioDocumentBarProps extends DocumentBarProps {
  documentName?: string;
  /** Real branch/version and connection state supplied by the owning product. */
  documentState?: ReactNode;
}

/** Transparent document identity on the left; configurable utilities/account on the right. */
export function StudioDocumentBar({ documentName, documentState, leading, className = "", ...props }: StudioDocumentBarProps) {
  useStudioDesignDefaults();
  const account = props.account ?? <div className="aui-studio-account">
    <div className="aui-studio-account-mount" data-aether-account="" />
    <MenuButton className="aui-studio-local-account" label="Local workspace account" placement="bottom-end" items={[
      { id: "local", label: "Local workspace", disabled: true },
      { id: "settings", label: "Settings", icon: <AetherIcon name="settings"/> },
    ]} onSelect={() => props.application?.onSettings ? props.application.onSettings() : document.dispatchEvent(new window.CustomEvent("aether-open-settings", {cancelable:true}))}>
      <span aria-hidden="true">LU</span><AetherIcon name="chevron"/>
    </MenuButton>
  </div>;
  return <DocumentBar {...props} variant="transparent" compactControls account={account}
    className={`aui-studio-document-bar ${className}`}
    leading={<>{documentName && <><span className="aui-studio-document-divider" aria-hidden="true"/><strong className="aui-studio-document-title" title={documentName}>{documentName}</strong></>}{documentState}{leading}</>} />;
}
