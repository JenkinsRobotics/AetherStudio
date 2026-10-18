import { useState } from "react";
import { Button, Dialog, FieldRow, NumberField, Popover, ProgressOverlay, TextField } from "../src/index";
import "./DialogPopoverSpecimens.css";

/** Always-visible specimens use the actual shared surfaces, with modal behavior off. */
export function DialogWindowSpecimens() {
  const [name, setName] = useState("Robot assembly");
  const [notice, setNotice] = useState("");
  return <div className="dialog-window-specimens">
    <Dialog inline open title="New assembly" onClose={() => setNotice("Close selected")}
      actions={<><Button onClick={() => setNotice("Creation cancelled")}>Cancel</Button><Button primary disabled={!name.trim()} onClick={() => setNotice(`Created ${name.trim()} · preview`)}>Create</Button></>}>
      <FieldRow label="Name"><TextField aria-label="Assembly name" value={name} onChange={event => setName(event.target.value)} /></FieldRow>
    </Dialog>
    <Dialog inline open title="Discard changes?" onClose={() => setNotice("Changes kept")}
      actions={<><Button onClick={() => setNotice("Changes kept")}>Keep editing</Button><Button onClick={() => setNotice("Changes discarded · preview")}>Discard</Button></>}>
      Your unsaved changes to this assembly will be lost.
    </Dialog>
    {notice && <small role="status">{notice}</small>}
  </div>;
}

export function PopoverWindowSpecimen() {
  const [placement, setPlacement] = useState(12.5);
  const [notice, setNotice] = useState("");
  return <div className="popover-window-specimen">
    <Popover inline open anchor={null} onClose={() => {}} ariaLabel="Quick properties">
      <div className="popover-window-content">
        <strong>Placement</strong>
        <NumberField aria-label="Placement" unit="mm" value={placement} onValueChange={value => setPlacement(value ?? 0)} />
        <Button onClick={() => setNotice(`Applied ${placement} mm · preview`)}>Apply</Button>
      </div>
    </Popover>
    {notice && <small role="status">{notice}</small>}
  </div>;
}

export function ProgressWindowSpecimen() {
  const [notice, setNotice] = useState("");
  return <div className="progress-window-specimen">
    <ProgressOverlay inline open label="Importing assembly" detail="Resolving exact topology and linked components." phase="2 of 4" value={48}
      onCancel={() => setNotice("Import cancelled · preview")} onBackground={() => setNotice("Run in background selected · preview")} />
    {notice && <small role="status">{notice}</small>}
  </div>;
}
