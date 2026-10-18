import {
  driveRequest,
  encodeFile,
  type DriveLocation,
  type DriveFile,
} from "@aether/session/library/drive-api";
const pending = new Map<string, string>();
function hint(key: string): string {
  try { return localStorage.getItem(key) ?? pending.get(key) ?? ""; } catch { return pending.get(key) ?? ""; }
}
function remember(key: string, value: string) {
  if (value) pending.set(key, value); else pending.delete(key);
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* in-memory recovery remains available */ }
}
/** A reselected file resumes its acknowledged chunks after a network failure. */
export async function uploadToDrive(
  file: File,
  destination: DriveLocation,
  userID: string,
  onProgress: (percent: number) => void,
  cancelled: () => boolean,
): Promise<DriveFile> {
  if (file.size > 512 * 1024 * 1024)
    throw new Error(`${file.name}: the current upload limit is 512 MB.`);
  const key = `aether-drive-upload:${userID}:${JSON.stringify(destination)}:${file.name}:${file.size}:${file.lastModified}`;
  let upload = hint(key), offset = 0;
  let operation = hint(`${key}:operation`);
  if (!operation) {
    operation = crypto.randomUUID();
    remember(`${key}:operation`, operation);
  }
  if (upload) {
    // Failure is not evidence that the server forgot this upload. Preserve the
    // reservation on a lost reply, expired session or permission error.
    const status = await driveRequest<{ offset: number; size: number; state?: string; chunks?: {digest: string; size: number}[] }>("upload_status", { upload });
    if (status.state === "expired" || status.state === "cancelled") {
      remember(key, ""); remember(`${key}:operation`, "");
      return uploadToDrive(file, destination, userID, onProgress, cancelled);
    }
    if (status.size !== file.size || !Number.isSafeInteger(status.offset) || status.offset < 0 || status.offset > file.size)
      throw new Error("The saved upload does not match this file.");
    if (status.chunks) {
      let checked = 0;
      for (const part of status.chunks) {
        if (!Number.isSafeInteger(part.size) || part.size <= 0 || part.size > 1024 * 1024 || checked + part.size > status.offset)
          throw new Error("The saved upload has invalid progress.");
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.slice(checked, checked + part.size).arrayBuffer()));
        const actual = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
        if (actual !== part.digest) throw new Error("This file differs from the interrupted upload. Select the original file to resume.");
        checked += part.size;
      }
      if (checked !== status.offset) throw new Error("The saved upload has incomplete progress.");
    }
    offset = status.offset;
  } else {
    const result = await driveRequest<{ id: string; offset: number }>("upload_begin", {
      ...destination, operation_id: operation, name: file.name, size: file.size,
    });
    if (typeof result.id !== "string" || !/^[A-Za-z0-9_.:-]{1,128}$/.test(result.id) || !Number.isSafeInteger(result.offset) || result.offset < 0 || result.offset > file.size)
      throw new Error("The upload reply was incomplete. Select this file again to check its saved progress.");
    upload = result.id;
    remember(key, upload);
    // A replayed begin can only have chunks if an earlier invocation already
    // stored its ID; resume through status so those bytes are checked.
    if (result.offset > 0) return uploadToDrive(file, destination, userID, onProgress, cancelled);
  }
  while (offset < file.size) {
    if (cancelled()) {
      await driveRequest("upload_cancel", { upload });
      remember(key, ""); remember(`${key}:operation`, "");
      throw new Error("Upload cancelled.");
    }
    const blob = file.slice(offset, offset + 1024 * 1024);
    const result = await driveRequest<{ offset: number }>("upload_chunk", {
      upload,
      offset,
      data_base64: await encodeFile(new File([blob], file.name)),
    });
    if (result.offset !== offset + blob.size) throw new Error("The server returned unexpected upload progress.");
    offset = result.offset;
    onProgress(Math.round((offset / file.size) * 100));
  }
  if (cancelled()) {
    await driveRequest("upload_cancel", { upload });
    remember(key, ""); remember(`${key}:operation`, "");
    throw new Error("Upload cancelled.");
  }
  const result = await driveRequest<DriveFile>("upload_finish", { upload });
  if (typeof result.id !== "string" || !result.id || !Number.isSafeInteger(result.revision) || result.revision < 1)
    throw new Error("The upload may already be saved, but its reply was incomplete. Select this file again to check.");
  remember(key, ""); remember(`${key}:operation`, "");
  onProgress(100);
  return result;
}
