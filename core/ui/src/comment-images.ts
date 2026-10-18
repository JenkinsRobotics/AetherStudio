import type { CommentImage } from "./DocumentServices";
function encode(source: CanvasImageSource, width: number, height: number, name: string): CommentImage {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image attachments are unavailable in this browser.");
  context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data_url = canvas.toDataURL("image/jpeg", .8);
  if (data_url.length > 1400000) throw new Error("Choose a smaller image (under 1 MB).");
  return { name: name.slice(0, 160), data_url };
}
export async function commentImage(file: File): Promise<CommentImage> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error("Choose a PNG, JPEG or WebP image under 20 MB.");
  const bitmap = await createImageBitmap(file);
  try { return encode(bitmap, bitmap.width, bitmap.height, file.name); }
  finally { bitmap.close(); }
}
/** User-initiated browser chooser; tracks always stop after the selected frame. */
export async function commentScreenshot(): Promise<CommentImage> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen capture is unavailable. Attach an image instead.");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const video = document.createElement("video");
  try {
    video.srcObject = stream; video.muted = true; await video.play();
    return encode(video, video.videoWidth, video.videoHeight, "Screenshot.jpg");
  } finally {
    stream.getTracks().forEach(track => track.stop()); video.srcObject = null;
  }
}
