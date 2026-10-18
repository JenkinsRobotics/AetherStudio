import { api } from './api';
import { encodeFile } from './drive-api';

/** Only registered, product-owned entry points can supply native file bytes. */
const factories: Record<string, string> = {
  cad: '/cad/create-document.js', map: '/map/create-document.js',
  animation: '/animation/create-document.js', sketch: '/sketch/create-document.js', io: '/io/create-document.js',
};
export async function createNativeFile<T>(app: string, kind: string, name: string, destination: object, service: 'library' | 'drive' = 'library'): Promise<T> {
  if (app === 'cad' && (kind === 'assembly' || kind === 'project')) {
    const base = name.trim().replace(kind === 'assembly' ? /\.acasm$/i : /\.acad$/i, '').trim();
    return api<T>('/api/library/project_create', { app, name: base, packaging: kind, ...destination });
  }
  const moduleURL = factories[app];
  if (!moduleURL) throw new Error('This app does not support file creation yet.');
  const product: { createDocument: (name: string) => File | Promise<File> } = await import(/* @vite-ignore */ moduleURL);
  const file = await product.createDocument(name);
  return api<T>(`/api/${service}/create`, { app, name: file.name, kind: 'file', data_base64: await encodeFile(file), ...destination });
}
