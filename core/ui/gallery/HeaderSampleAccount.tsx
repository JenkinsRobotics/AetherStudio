import { useState } from "react";
import { Avatar, Button, IconButton, Popover } from "../src";
import "./HeaderSampleAccount.css";

/** The account-card content used by CAD's Studio account control, with sample identity only. */
export function HeaderSampleAccount({ onViewAccount, name = "Alex Morgan", detail = "alex.morgan@example.com" }: { onViewAccount: () => void; name?: string; detail?: string }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return <>
    <IconButton label={`Account: ${name}`} appearance="glyph" className="header-sample-account-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={event => { setAnchor(event.currentTarget); setOpen(value => !value); }}>
      <Avatar name={name} size="small"/>
    </IconButton>
    <Popover open={open} anchor={anchor} onClose={() => setOpen(false)} ariaLabel={`${name} account`} placement="bottom-end" focus="first" className="header-sample-account">
      <div className="header-sample-account-top"><strong>Aether Studio</strong><Button appearance="flat" disabled title="This preview has no connected account to sign out of.">Sign out</Button></div>
      <div className="header-sample-account-identity">
        <Avatar name={name}/>
        <strong>{name}</strong><small>{detail}</small>
        <Button appearance="flat" onClick={() => { setOpen(false); onViewAccount(); }}>View account</Button>
        <Button appearance="flat" disabled title="Aether Agent needs a connected account.">Aether Agent</Button>
      </div>
    </Popover>
  </>;
}
