import {useCallback, useEffect, useRef, useState} from 'react';
import {inLibraryWorkspace, type LibraryLocation} from './library-location';
import {api} from "@aether/session/library/api";

/** Keep asynchronous results attached to the directory that requested them. */
export function useLibraryListing<T extends LibraryLocation>({app, view, parent, query, location}: {
  app: string; view: string; parent: string | null; query: string; location: LibraryLocation | null;
}) {
  const [files, setFiles] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const key = JSON.stringify([app, view, parent, query, location?.organization, location?.workspace]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const reload = useCallback(async (): Promise<T[] | null> => {
    // A mutation may finish after its caller has navigated elsewhere.
    if (key !== currentKey.current) return null;
    const request = ++generation.current;
    const current = () => request === generation.current && key === currentKey.current;
    setLoading(true);
    setError('');
    try {
      const result = view === 'trash' || view === 'shared' ? {files: []} :
        await api<{files: T[]}>('/api/library/list', {
          app, view: view === 'home' ? (query ? 'personal' : 'recent') : view, parent, query,
        });
      if (!current()) return null;
      const visible = view === "workspace" ? inLibraryWorkspace(result.files, location) : result.files;
      setFiles(visible);
      return visible;
    } catch (cause) {
      if (current()) {
        setFiles([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load files.');
      }
      return null;
    } finally {
      if (current()) setLoading(false);
    }
  }, [app, view, parent, query, key]);
  useEffect(() => {
    setFiles([]);
    void reload();
    return () => { generation.current++; };
  }, [reload]);
  return {files, loading, error, reload};
}
