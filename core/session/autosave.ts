/** Host-session infrastructure only: products supply their own serialized document. */
export interface RecoveryRecord<Base> { text: string; base: Base; blocked?: string }
export type SavePhase = 'saved' | 'pending' | 'saving' | 'offline' | 'conflict' | 'local';
export interface SaveState { phase: SavePhase; durable: boolean; message?: string }
export class SaveError extends Error {
  constructor(message: string, readonly status: number, readonly retryable = ![400, 401, 403, 404, 409, 413, 415, 422, 501].includes(status)) { super(message); }
}
export function readRecovery<Base>(key: string): RecoveryRecord<Base> | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    return value && typeof value.text === 'string' && 'base' in value ? value : null;
  } catch { return null; }
}
/** Account + document isolation; sessionStorage also separates concurrent tabs. */
export function recoveryKey(app: string, owner: string, document: string) {
  return `aether.recovery.v1:${app}:${encodeURIComponent(owner)}:${encodeURIComponent(document)}`;
}
export async function sessionOwner(): Promise<string> {
  let response: Response;
  try { response = await fetch('/api/status'); }
  catch (error) {
    const cached = sessionStorage.getItem('aether.recovery.owner');
    if (cached) return cached;
    throw error;
  }
  if (!response.ok) throw new SaveError('Sign in to access your saved documents.', response.status);
  const result = await response.json();
  if (!result.user?.id && !result.user?.username) throw new SaveError('Sign in to access your saved documents.', 401);
  const owner = String(result.user.id ?? result.user.username);
  try { sessionStorage.setItem('aether.recovery.owner', owner); } catch { /* saving still works without storage */ }
  return owner;
}

/** One in-flight write; a completed older write can never clear a newer draft. */
export class AutosaveSession<Base> {
  base: Base;
  private key: string;
  private pending: string | null = null;
  private savedText = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private paused = false;
  private blocked = false;
  private recoveryBlock: string | undefined;
  private disposed = false;
  private durable = false;
  private listeners = new Set<(state: SaveState) => void>();
  state: SaveState = { phase: 'saved', durable: true };
  constructor(private options: {
    key: string; base: Base; text?: string; delayMs?: number;
    save: (text: string, base: Base) => Promise<Base>;
    keyForBase?: (base: Base) => string;
  }) {
    this.key = options.key; this.base = options.base; this.savedText = options.text ?? '';
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.retry);
      window.addEventListener('pagehide', this.hide);
      window.addEventListener('beforeunload', this.unload);
      document.addEventListener('visibilitychange', this.visibility);
    }
  }
  get dirty() { return this.pending !== null; }
  subscribe(listener: (state: SaveState) => void) {
    this.listeners.add(listener); listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  private publish(phase: SavePhase, message?: string) {
    this.state = { phase, durable: this.durable || !this.dirty, message };
    if (!this.disposed) for (const listener of this.listeners) listener(this.state);
  }
  private persist() {
    try {
      if (this.pending === null) sessionStorage.removeItem(this.key);
      else sessionStorage.setItem(this.key, JSON.stringify({ text: this.pending, base: this.base, ...(this.recoveryBlock ? { blocked: this.recoveryBlock } : {}) }));
      this.durable = true;
    } catch { this.durable = false; }
  }
  write(text: string, force = false) {
    if (!force && (text === this.pending || (!this.dirty && text === this.savedText))) return;
    this.pending = text;
    this.persist(); // synchronous: protected before a refresh, not after the debounce
    if (!this.blocked) this.publish(this.paused ? 'local' : 'pending');
    this.schedule();
  }
  recover(record: RecoveryRecord<Base>, conflict = false) {
    this.base = record.base; this.pending = record.text; this.persist();
    if (typeof record.blocked === 'string' && record.blocked) this.block(record.blocked);
    else if (conflict) this.block('The file changed elsewhere. Your recovered edits are kept in this tab; save a copy to keep both versions.');
    else { this.publish('pending'); this.schedule(); }
  }
  block(message: string) { this.blocked = true; this.recoveryBlock = message; this.persist(); this.publish('conflict', message); }
  pause(value: boolean) {
    this.paused = value;
    if (!value && this.dirty) this.schedule();
  }
  /** Change metadata after a rename, without discarding edits waiting to save. */
  updateBase(base: Base) { this.base = base; this.persist(); }
  /** A user-requested copy starts from a new document, retaining the local text. */
  copyTo(base: Base) { this.base = base; this.blocked = false; this.recoveryBlock = undefined; this.persist(); this.schedule(); }
  private schedule(delay = this.options.delayMs ?? 1200) {
    if (this.timer || this.disposed || this.paused || this.blocked || !this.dirty) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => {}); }, delay);
  }
  private retry = () => { if (!this.blocked) void this.flush().catch(() => {}); };
  private hide = () => { this.persist(); this.retry(); };
  private visibility = () => { if (document.visibilityState === 'hidden') this.hide(); };
  private unload = (event: BeforeUnloadEvent) => {
    this.persist();
    if (this.dirty && !this.durable) { event.preventDefault(); event.returnValue = ''; }
  };
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.inFlight) { await this.inFlight; if (this.dirty && !this.paused && !this.blocked) return this.flush(); return; }
    if (this.disposed || this.paused || !this.dirty) return;
    if (this.blocked) throw new SaveError(this.state.message ?? 'Saving is blocked.', 409);
    const text = this.pending!;
    this.recoveryBlock = 'A save was interrupted. Your draft is retained. Check the saved document before continuing or saving a copy.';
    this.persist();
    this.publish('saving');
    this.inFlight = (async () => {
      try {
        const base = await this.options.save(text, this.base);
        this.recoveryBlock = undefined;
        this.base = base; this.savedText = text;
        const oldKey = this.key;
        this.key = this.options.keyForBase?.(base) ?? this.key;
        if (this.pending === text) this.pending = null;
        this.persist();
        // Remove the untitled key only after its replacement is recoverable.
        if (oldKey !== this.key && this.durable) { try { sessionStorage.removeItem(oldKey); } catch { /* retained fallback */ } }
        this.publish(this.dirty ? 'pending' : 'saved');
      } catch (error) {
        const permanent = error instanceof SaveError && !error.retryable;
        if (permanent) { this.blocked = true; this.recoveryBlock = (error as Error).message; }
        else this.recoveryBlock = undefined;
        this.persist();
        this.publish(permanent ? 'conflict' : 'offline', (error as Error).message);
        if (!permanent) this.schedule(5000);
        throw error;
      } finally { this.inFlight = null; }
    })();
    await this.inFlight;
    if (this.dirty) this.schedule();
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.retry); window.removeEventListener('pagehide', this.hide);
      window.removeEventListener('beforeunload', this.unload); document.removeEventListener('visibilitychange', this.visibility);
    }
  }
}
