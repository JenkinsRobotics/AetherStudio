import type {
  FileExpectation,
  FileFingerprint,
  LocalFileErrorCode,
  LocalSaveReceipt,
  BrowserRecoveryDraft,
  BrowserRecoveryCandidate,
  RecoveryListing,
} from "@aether/protocol";
export type {
  FileExpectation,
  FileFingerprint,
  LocalSaveReceipt,
  BrowserRecoveryCandidate,
  RecoveryListing,
} from "@aether/protocol";

export const MAX_DOCUMENT_BYTES = 64 * 1024 * 1024;
const MAX_RECOVERY_BYTES = Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 16 * 1024;
const LOCK_NAME = "aether-ordinary-files-v1";
const SESSION = /^[A-Za-z0-9_-]{1,128}$/;
const SHA = /^[0-9a-f]{64}$/;

/** A capability returned by a user file picker or an explicitly chosen OPFS root.
 * No path strings are accepted and this package never opens a picker itself. */
export interface FileHandle {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<Blob>;
  createWritable(options?: {
    keepExistingData?: boolean;
    mode?: "exclusive";
  }): Promise<{
    write(data: ArrayBuffer | string): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
}
export interface DirectoryHandle {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandle>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterableIterator<[string, { kind: "file" | "directory" }]>;
}
export interface FileEnvironment {
  /** Pass navigator.locks. Required: do not pretend a per-tab mutex protects tabs. */
  locks: Pick<LockManager, "request">;
  /** Pass crypto; a secure context is required. */
  crypto: Pick<Crypto, "subtle">;
  /** Pass the result of navigator.storage.getDirectory() for persistent drafts. */
  recoveryRoot?: DirectoryHandle;
}
export class LocalFileError extends Error {
  constructor(
    public readonly code: LocalFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LocalFileError";
  }
}
function fail(code: LocalFileErrorCode, message: string): never {
  throw new LocalFileError(code, message);
}
function translated(error: unknown): LocalFileError {
  if (error instanceof LocalFileError) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "NotFoundError")
    return new LocalFileError(
      "not_found",
      "The selected file is no longer available.",
    );
  if (name === "NotAllowedError" || name === "SecurityError")
    return new LocalFileError(
      "permission_denied",
      "Choose the file again to grant access.",
    );
  if (name === "QuotaExceededError")
    return new LocalFileError(
      "quota_exceeded",
      "There is not enough browser storage for this draft.",
    );
  if (name === "NoModificationAllowedError")
    return new LocalFileError("busy", "Another writer is using this file.");
  return new LocalFileError(
    "io_failure",
    "The browser could not complete this file operation.",
  );
}
function expectation(value: FileExpectation): void {
  if (
    !value ||
    (value.kind !== "missing" &&
      (value.kind !== "content" || !SHA.test(value.sha256)))
  )
    fail("invalid_request", "Supply the expected file fingerprint.");
}
function fingerprintShape(value: unknown): value is FileFingerprint {
  const v = value as FileFingerprint | null;
  return (
    !!v &&
    typeof v.sha256 === "string" &&
    SHA.test(v.sha256) &&
    Number.isSafeInteger(v.size_bytes) &&
    v.size_bytes >= 0 &&
    v.size_bytes <= MAX_DOCUMENT_BYTES
  );
}
function equal(a: FileFingerprint, b: FileFingerprint): boolean {
  return a.sha256 === b.sha256 && a.size_bytes === b.size_bytes;
}
function matches(
  expected: FileExpectation,
  actual: FileFingerprint | null,
): boolean {
  return expected.kind === "missing"
    ? actual === null
    : expected.sha256 === actual?.sha256;
}
function sessionId(value: string): void {
  if (!SESSION.test(value))
    fail("invalid_request", "Use a valid editor session ID.");
}
function encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function decode(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    fail("corrupt_recovery", "Recovery content is invalid.");
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (encode(bytes) !== value || bytes.length > MAX_DOCUMENT_BYTES)
    fail("corrupt_recovery", "Recovery content is invalid.");
  return bytes;
}

/** One selected document, or an untitled document with only recoverable drafts.
 * documentKey is an app-owned stable ID. It grants no file access and is never an
 * OS path. Reopening still requires an explicit file capability from the caller. */
export class BrowserDocument {
  constructor(
    private readonly handle: FileHandle | null,
    readonly documentKey: string,
    private readonly environment: FileEnvironment,
  ) {
    if (!documentKey || documentKey.length > 1024)
      fail("invalid_request", "Supply a stable document key.");
    if (!environment.crypto?.subtle || !environment.locks?.request)
      fail(
        "unsupported",
        "Secure browser file storage and cross-tab locks are required.",
      );
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await this.environment.locks.request(
        LOCK_NAME,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock)
            fail("busy", "Another Aether file operation is in progress.");
          return work();
        },
      );
    } catch (error) {
      throw translated(error);
    }
  }
  private async fingerprint(content: Uint8Array): Promise<FileFingerprint> {
    if (content.length > MAX_DOCUMENT_BYTES)
      fail("too_large", "Document exceeds the 64 MiB file limit.");
    const digest = await this.environment.crypto.subtle.digest(
      "SHA-256",
      Uint8Array.from(content).buffer,
    );
    return {
      sha256: Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
      size_bytes: content.length,
    };
  }
  private async current(): Promise<{
    file: FileFingerprint;
    content: Uint8Array;
  } | null> {
    if (!this.handle) return null;
    let blob: Blob;
    try {
      blob = await this.handle.getFile();
    } catch (error) {
      if (translated(error).code === "not_found") return null;
      throw error;
    }
    if (blob.size > MAX_DOCUMENT_BYTES)
      fail("too_large", "Document exceeds the 64 MiB file limit.");
    const content = new Uint8Array(await blob.arrayBuffer());
    return { file: await this.fingerprint(content), content };
  }
  async read(): Promise<{ file: FileFingerprint; content: Uint8Array }> {
    try {
      return (
        (await this.current()) ?? fail("not_found", "Choose a document file.")
      );
    } catch (error) {
      throw translated(error);
    }
  }
  async save(
    expected: FileExpectation,
    content: Uint8Array,
  ): Promise<LocalSaveReceipt> {
    expectation(expected);
    const guard = { ...expected };
    if (content.length > MAX_DOCUMENT_BYTES)
      fail("too_large", "Document exceeds the 64 MiB file limit.");
    const bytes = Uint8Array.from(content);
    const file = await this.fingerprint(bytes);
    return this.exclusive(async () => {
      if (!this.handle)
        fail("permission_denied", "Choose a file before saving.");
      if (!matches(guard, (await this.current())?.file ?? null))
        fail("conflict", "The file changed outside this editor.");
      const writer = await this.handle.createWritable({
        keepExistingData: false,
        mode: "exclusive",
      });
      let closing = false;
      try {
        await writer.write(bytes.buffer);
        if (!matches(guard, (await this.current())?.file ?? null))
          fail("conflict", "The file changed while the save was prepared.");
        closing = true;
        await writer.close();
        return { file, durability: "browser_managed" };
      } catch (error) {
        if (closing)
          fail(
            "outcome_unknown",
            "The save could have completed. Reopen the file before retrying.",
          );
        try {
          await writer.abort();
        } catch {
          /* Original failure remains; publication was not requested. */
        }
        throw error;
      }
    });
  }
  private async directory(create: boolean): Promise<DirectoryHandle | null> {
    const root = this.environment.recoveryRoot;
    if (!root) fail("unsupported", "Browser recovery storage is unavailable.");
    const hash = await this.fingerprint(
      new TextEncoder().encode(this.documentKey),
    );
    try {
      const namespace = await root.getDirectoryHandle(
        "aether-file-recovery-v1",
        { create },
      );
      return await namespace.getDirectoryHandle(hash.sha256, { create });
    } catch (error) {
      if (translated(error).code === "not_found" && !create) return null;
      throw error;
    }
  }
  async stageRecovery(
    session: string,
    base: FileExpectation,
    content: Uint8Array,
  ): Promise<LocalSaveReceipt> {
    sessionId(session);
    expectation(base);
    const guard = { ...base };
    if (content.length > MAX_DOCUMENT_BYTES)
      fail("too_large", "Document exceeds the 64 MiB file limit.");
    const bytes = Uint8Array.from(content);
    const fingerprint = await this.fingerprint(bytes);
    const draft: BrowserRecoveryDraft = {
      format_version: 1,
      document_key: this.documentKey,
      session_id: session,
      base: guard,
      content: fingerprint,
      content_base64: encode(bytes),
    };
    return this.exclusive(async () => {
      const directory = (await this.directory(true))!;
      let count = 0,
        existing = false;
      for await (const [name] of directory.entries()) {
        if (name.endsWith(".json")) count++;
        if (name === `${session}.json`) existing = true;
      }
      if (!existing && count >= 128)
        fail("too_large", "Recovery already contains 128 editor sessions.");
      const file = await directory.getFileHandle(`${session}.json`, {
        create: true,
      });
      const writer = await file.createWritable({
        keepExistingData: false,
        mode: "exclusive",
      });
      let closing = false;
      try {
        await writer.write(JSON.stringify(draft));
        closing = true;
        await writer.close();
      } catch (error) {
        if (closing)
          fail(
            "outcome_unknown",
            "The draft may have been saved. Check recovery before retrying.",
          );
        try {
          await writer.abort();
        } catch {
          /* Keep any previous draft. */
        }
        throw error;
      }
      return { file: fingerprint, durability: "browser_managed" };
    });
  }
  private async draft(
    directory: DirectoryHandle,
    session: string,
  ): Promise<BrowserRecoveryDraft | null> {
    let handle: FileHandle;
    try {
      handle = await directory.getFileHandle(`${session}.json`);
    } catch (error) {
      if (translated(error).code === "not_found") return null;
      throw error;
    }
    const blob = await handle.getFile();
    if (blob.size > MAX_RECOVERY_BYTES)
      fail("corrupt_recovery", "Recovery file exceeds its size limit.");
    let draft: BrowserRecoveryDraft;
    try {
      draft = JSON.parse(await blob.text()) as BrowserRecoveryDraft;
      if (
        !draft ||
        draft.format_version !== 1 ||
        draft.document_key !== this.documentKey ||
        draft.session_id !== session ||
        !fingerprintShape(draft.content)
      )
        throw new Error();
      if (
        Object.keys(draft).sort().join(",") !==
        "base,content,content_base64,document_key,format_version,session_id"
      )
        throw new Error();
      expectation(draft.base);
    } catch {
      fail("corrupt_recovery", "Recovery metadata is invalid.");
    }
    const bytes = decode(draft.content_base64);
    if (!equal(await this.fingerprint(bytes), draft.content))
      fail("corrupt_recovery", "Recovery checksum does not match its content.");
    return draft;
  }
  async recovery(session: string): Promise<BrowserRecoveryCandidate | null> {
    sessionId(session);
    return this.exclusive(async () => {
      const directory = await this.directory(false);
      if (!directory) return null;
      const draft = await this.draft(directory, session);
      if (!draft) return null;
      const current = (await this.current())?.file ?? null;
      return {
        draft,
        base_matches_current_file: matches(draft.base, current),
        content_matches_current_file:
          !!current && equal(draft.content, current),
      };
    });
  }
  async listRecovery(): Promise<RecoveryListing> {
    return this.exclusive(async () => {
      const listing: RecoveryListing = { drafts: [], corrupt_sessions: [] };
      const directory = await this.directory(false);
      if (!directory) return listing;
      const current = (await this.current())?.file ?? null;
      let count = 0;
      for await (const [name, entry] of directory.entries()) {
        if (!name.endsWith(".json")) continue;
        if (++count > 128)
          fail("too_large", "Recovery contains more than 128 editor sessions.");
        const session = name.slice(0, -5);
        if (!SESSION.test(session) || entry.kind !== "file") {
          listing.corrupt_sessions.push(session);
          continue;
        }
        try {
          const draft = await this.draft(directory, session);
          if (!draft) continue;
          listing.drafts.push({
            session_id: session,
            content: draft.content,
            base_matches_current_file: matches(draft.base, current),
            content_matches_current_file:
              !!current && equal(draft.content, current),
          });
        } catch (error) {
          if (translated(error).code !== "corrupt_recovery") throw error;
          listing.corrupt_sessions.push(session);
        }
      }
      listing.drafts.sort((a, b) => a.session_id.localeCompare(b.session_id));
      listing.corrupt_sessions.sort();
      return listing;
    });
  }
  async discardRecovery(
    session: string,
    expected: FileFingerprint,
  ): Promise<void> {
    sessionId(session);
    if (!fingerprintShape(expected))
      fail("invalid_request", "Supply the draft fingerprint.");
    const fingerprint = { ...expected };
    return this.exclusive(async () => {
      const directory = await this.directory(false);
      if (!directory) return;
      const draft = await this.draft(directory, session);
      if (!draft) return;
      if (!equal(draft.content, fingerprint))
        fail("conflict", "This recovery draft has changed.");
      await directory.removeEntry(`${session}.json`);
    });
  }
}
