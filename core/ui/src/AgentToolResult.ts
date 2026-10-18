import type { AgentImage, AgentToolContent, AgentToolReply } from './AgentServices';

export const AGENT_IMAGE_BYTES = 256 * 1024;
export const AGENT_IMAGE_EDGE = 1024;
export const AGENT_IMAGES_PER_TURN = 8;

/** Explicit opt-in envelope; ordinary product JSON remains backward compatible. */
export function agentToolContent(value: unknown, image: AgentImage): AgentToolContent {
  return { type: 'aether.tool-content', value, images: [image] };
}
export function agentToolReply(value: unknown, imagesSupported: boolean, imagesUsed: number): AgentToolReply {
  const envelope = value && typeof value === 'object' && 'type' in value && value.type === 'aether.tool-content'
    ? value as AgentToolContent : null;
  const normalized = (envelope ? envelope.value : value) ?? null;
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > 32000)
    throw Error('The tool result is too large. Request a smaller selection.');
  if (!envelope) return { ok: true, value: normalized };
  if (!imagesSupported) throw Error('This Studio server does not support agent previews yet.');
  if (imagesUsed >= AGENT_IMAGES_PER_TURN) throw Error('Preview limit reached for this turn. Continue in a new message.');
  if (!Array.isArray(envelope.images) || envelope.images.length !== 1) throw Error('Expected one bounded PNG preview.');
  const image = envelope.images[0];
  validateAgentImage(image);
  return { ok: true, value: normalized, images: [image] };
}
export function validateAgentImage(image: AgentImage) {
  if (image?.mimeType !== 'image/png' || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      image.width < 1 || image.height < 1 || image.width > AGENT_IMAGE_EDGE || image.height > AGENT_IMAGE_EDGE ||
      typeof image.data !== 'string' || image.data.length > 4 * Math.ceil(AGENT_IMAGE_BYTES / 3) ||
      (image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)))
    throw Error('Invalid or oversized PNG preview.');
  const bytes = atob(image.data);
  const uint = (offset: number) => ((bytes.charCodeAt(offset) * 16777216) +
    (bytes.charCodeAt(offset + 1) << 16) + (bytes.charCodeAt(offset + 2) << 8) + bytes.charCodeAt(offset + 3));
  if (bytes.length > AGENT_IMAGE_BYTES || bytes.length < 45 || btoa(bytes) !== image.data ||
      bytes.slice(0, 8) !== '\x89PNG\r\n\x1a\n' || uint(8) !== 13 || bytes.slice(12, 16) !== 'IHDR' ||
      uint(16) !== image.width || uint(20) !== image.height || bytes.slice(-12) !== '\0\0\0\0IEND\xaeB\x60\x82')
    throw Error('Invalid PNG preview dimensions or data.');
}

/** Encode only a product-owned canvas, never the page, panels or desktop. */
export function agentCanvasImage(source: HTMLCanvasElement, signal: AbortSignal): AgentImage {
  signal.throwIfAborted();
  if (!source.width || !source.height) throw Error('The product preview is not ready.');
  let scale = Math.min(1, AGENT_IMAGE_EDGE / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  if (!context) throw Error('Preview rendering is unavailable.');
  for (let attempt = 0; attempt < 5; attempt++, scale *= 0.7) {
    signal.throwIfAborted();
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    let data: string;
    try { data = canvas.toDataURL('image/png').split(',')[1]; }
    catch { throw Error('This preview contains media that cannot be captured.'); }
    if (data && data.length <= 4 * Math.floor(AGENT_IMAGE_BYTES / 3)) {
      const image: AgentImage = { mimeType: 'image/png', data, width: canvas.width, height: canvas.height };
      validateAgentImage(image); return image;
    }
  }
  throw Error('The preview is too large. Reduce its complexity and try again.');
}
