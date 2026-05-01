/**
 * Helpers de classificação e formatação de arquivos da entrevista.
 * Usado pelo FileExplorer e pela página da entrevista para decidir
 * qual viewer mostrar (markdown / audio / video / outro).
 */

export type FileKind = "markdown" | "audio" | "video" | "other";

const MARKDOWN_EXT = new Set(["md", "markdown", "txt"]);
const AUDIO_EXT    = new Set(["wav", "mp3", "m4a", "aac", "ogg", "oga", "flac", "opus"]);
const VIDEO_EXT    = new Set(["mp4", "m4v", "mkv", "mov", "avi", "webm"]);

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function detectKind(name: string): FileKind {
  const ext = fileExtension(name);
  if (MARKDOWN_EXT.has(ext)) return "markdown";
  if (AUDIO_EXT.has(ext))    return "audio";
  if (VIDEO_EXT.has(ext))    return "video";
  return "other";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024)               return `${bytes} B`;
  if (bytes < 1024 * 1024)        return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatModified(epochSec: number): string {
  // Formato compacto. Se for hoje → HH:mm, senão dd/MM HH:mm.
  const d = new Date(epochSec * 1000);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}

/**
 * Mapeamento de nome de arquivo de output → DocType lógico do backend.
 * Usado para decidir qual rota chamar para get/put.
 */
export const FILENAME_TO_DOC: Record<string, "raw" | "refined" | "structured" | "glossary"> = {
  "01_transcricao_bruta.md":      "raw",
  "02_transcricao_refinada.md":   "refined",
  "03_entrevista_estruturada.md": "structured",
  "glossario_local.md":           "glossary",
};
