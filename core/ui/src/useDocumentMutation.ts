import { useEffect, useRef, useState } from "react";
import type { DocumentConnection } from "./DocumentServices";

interface Pending {
  key: string;
  action: string;
  data: Record<string, unknown>;
  replaySafe: boolean;
}
/** Presentation-level explicit retry. The transport is still supplied by the host.
 * A retry never flushes, reads newer guards or rebuilds arguments from edited fields. */
export function useDocumentMutation(connection: DocumentConnection, recovered: (action: string, result: unknown) => Promise<void>, replaySafe = false) {
  const pending = useRef<Pending | null>(null);
  const context = useRef(connection.key); context.current = connection.key;
  const [uncertain, setUncertain] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    pending.current = null;
    setUncertain(false);
  }, [connection.key]);
  useEffect(() => {
    if (!uncertain) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uncertain]);
  const execute = async (command: Pending) => {
    let result: unknown;
    try { result = await connection.call(command.action, command.data); }
    catch (error) {
      if (context.current !== command.key) throw error;
      if ((error as {detail?: {code?: string}}).detail?.code === "outcome_unknown") {
        pending.current = command;
        setUncertain(true);
      } else { pending.current = null; setUncertain(false); }
      throw error;
    }
    // The acknowledgement is definitive even if the subsequent UI refresh fails.
    if (context.current === command.key) { pending.current = null; setUncertain(false); }
    return result;
  };
  return {
    uncertain, retrying, canRetry: uncertain && pending.current?.replaySafe === true,
    async send<T = unknown>(action: string, data: Record<string, unknown>): Promise<T> {
      if (pending.current) throw new Error("Resolve the previous change before making another one.");
      const command = {key:connection.key, action, replaySafe, data:JSON.parse(JSON.stringify({...data,operation_id:crypto.randomUUID()}))};
      pending.current = command;
      return await execute(command) as T;
    },
    async retry() {
      const command = pending.current;
      if (!command || !command.replaySafe || retrying || command.key !== connection.key) return;
      setRetrying(true);
      try { const result = await execute(command); await recovered(command.action, result); } finally { setRetrying(false); }
    },
  };
}
