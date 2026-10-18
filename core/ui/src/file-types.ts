/** File presentation only. Recognition never grants permission or chooses an editor. */
export interface FileIdentity {
  name: string;
  kind?: string;
  mime?: string;
  app?: string;
}
export interface FileTypeDefinition {
  id: string;
  label: string;
  plural: string;
  icon: string;
  extensions: readonly string[];
  mimes?: readonly string[];
}
export const FILE_TYPES: readonly FileTypeDefinition[] = [
  { id: "part", label: "Part", plural: "Parts", icon: "file-part", extensions: ["acpart", "cadpart"] },
  { id: "assembly", label: "Assembly", plural: "Assemblies", icon: "file-assembly", extensions: ["acasm"] },
  { id: "drawing", label: "Drawing", plural: "Drawings", icon: "file-drawing", extensions: ["acdrw", "acdraw"] },
  { id: "project", label: "Project", plural: "Projects", icon: "file-project", extensions: ["acad"] },
  { id: "show", label: "Show", plural: "Shows", icon: "file-show", extensions: ["aethermap", "show"] },
  { id: "character", label: "Character", plural: "Characters", icon: "file-character", extensions: ["anima"] },
  { id: "clip", label: "Clip", plural: "Clips", icon: "file-clip", extensions: ["clip"] },
  { id: "workspace", label: "Workspace", plural: "Workspaces", icon: "file-workspace", extensions: ["aether", "animastudio"] },
  { id: "sketch", label: "Sketch", plural: "Sketches", icon: "file-sketch", extensions: ["aethersketch"] },
  { id: "circuit", label: "Circuit", plural: "Circuits", icon: "file-circuit", extensions: ["aetherio"] },
  { id: "vector", label: "Vector graphic", plural: "Vectors", icon: "file-vector", extensions: ["aethervector", "svg"], mimes: ["image/svg+xml"] },
  { id: "word", label: "Word document", plural: "Word documents", icon: "file-word", extensions: ["doc", "docx", "docm", "dot", "dotx", "odt", "rtf"], mimes: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.oasis.opendocument.text", "application/rtf"] },
  { id: "spreadsheet", label: "Spreadsheet", plural: "Spreadsheets", icon: "file-spreadsheet", extensions: ["xls", "xlsx", "xlsm", "xlsb", "ods", "csv", "tsv"], mimes: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.oasis.opendocument.spreadsheet", "text/csv", "text/tab-separated-values"] },
  { id: "presentation", label: "Presentation", plural: "Presentations", icon: "file-presentation", extensions: ["ppt", "pptx", "pptm", "pps", "ppsx", "odp"], mimes: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.oasis.opendocument.presentation"] },
  { id: "pdf", label: "PDF", plural: "PDFs", icon: "file-pdf", extensions: ["pdf"], mimes: ["application/pdf"] },
  { id: "image", label: "Image", plural: "Images", icon: "file-image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "tif", "tiff", "heic", "heif", "ico"] },
  { id: "video", label: "Video", plural: "Videos", icon: "file-video", extensions: ["mp4", "mov", "webm", "avi", "mkv", "m4v", "mpeg", "mpg"] },
  { id: "audio", label: "Audio file", plural: "Audio", icon: "file-audio", extensions: ["mp3", "wav", "ogg", "oga", "flac", "m4a", "aac", "aiff", "aif", "opus"] },
  { id: "archive", label: "Archive", plural: "Archives", icon: "file-archive", extensions: ["zip", "7z", "rar", "tar", "gz", "bz2", "xz"], mimes: ["application/zip", "application/x-7z-compressed", "application/x-rar-compressed", "application/x-tar", "application/gzip"] },
  { id: "model", label: "3D model", plural: "3D models", icon: "file-model", extensions: ["step", "stp", "iges", "igs", "stl", "obj", "gltf", "glb", "fbx", "3mf", "ply", "blend"], mimes: ["model/gltf+json", "model/gltf-binary", "model/stl"] },
  { id: "code", label: "Code file", plural: "Code", icon: "file-code", extensions: ["json", "js", "jsx", "ts", "tsx", "py", "html", "css", "xml", "yaml", "yml", "toml", "sh", "c", "cpp", "h", "rs"], mimes: ["application/json", "application/xml", "text/html", "text/css", "text/javascript"] },
  { id: "text", label: "Text document", plural: "Text documents", icon: "file-text", extensions: ["txt", "md", "log"], mimes: ["text/plain", "text/markdown"] },
  { id: "folder", label: "Folder", plural: "Folders", icon: "file-folder", extensions: [] },
  { id: "file", label: "File", plural: "Other files", icon: "file-generic", extensions: [] },
];
const byID = new Map(FILE_TYPES.map(type => [type.id, type]));
const byExtension = new Map(FILE_TYPES.flatMap(type => type.extensions.map(extension => [extension, type] as const)));
const byMime = new Map(FILE_TYPES.flatMap(type => (type.mimes ?? []).map(mime => [mime, type] as const)));
export const fileTypeDefinition = (id: string): FileTypeDefinition => byID.get(id) ?? byID.get("file")!;

export function fileTypeFor(file: FileIdentity): FileTypeDefinition {
  if (file.kind === "folder") return fileTypeDefinition("folder");
  const name = file.name.trim().toLowerCase();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  // Legacy .aether CAD assemblies predate the animation workspace format.
  if (extension === "aether" && file.app === "cad") return fileTypeDefinition("assembly");
  const native = byExtension.get(extension);
  if (native) return native;
  const mime = (file.mime ?? "").split(";")[0].trim().toLowerCase();
  const exact = byMime.get(mime);
  if (exact) return exact;
  for (const category of ["image", "video", "audio", "text"]) {
    if (mime.startsWith(`${category}/`)) return fileTypeDefinition(category);
  }
  // Only extensionless native records need a product hint. An unknown upload
  // in a CAD workspace must never acquire a misleading Part icon.
  if (!extension) {
    const fallback: Record<string, string> = { cad: "part", map: "show", animation: "character", sketch: "sketch", io: "circuit", vector: "vector" };
    if (file.app && fallback[file.app]) return fileTypeDefinition(fallback[file.app]);
  }
  return fileTypeDefinition("file");
}
