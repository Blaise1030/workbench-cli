export type FilePreviewType = "markdown" | "image" | "code";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif",
]);

export function getFilePreviewType(path: string): FilePreviewType {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "md" || ext === "mdx") return "markdown";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "code";
}
