"use client";

import { Download, FileAudio, FileVideo } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { formatSize } from "@/lib/files";

/**
 * Player de mídia da entrevista. Toca o arquivo servido pelo backend
 * (`/media`, com Range, então o seek funciona em gravações longas).
 * `key={src}` remonta o elemento ao trocar de arquivo e evita reaproveitar buffer.
 */
export function MediaPlayer({
  niche,
  interview,
  filename,
  size,
  kind,
}: {
  niche: string;
  interview: string;
  filename: string;
  size?: number;
  kind: "audio" | "video";
}) {
  const src = mediaUrl(niche, interview, filename);
  const Icon = kind === "video" ? FileVideo : FileAudio;

  return (
    <div className="space-y-2">
      {kind === "video" ? (
        <video key={src} src={src} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
      ) : (
        <audio key={src} src={src} controls preload="metadata" className="w-full" />
      )}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate" title={filename}>{filename}</span>
        {size !== undefined && <span className="shrink-0 tabular-nums">{formatSize(size)}</span>}
        <a
          href={src}
          download={filename}
          aria-label={`Baixar ${filename}`}
          title="Baixar arquivo"
          className="shrink-0 rounded p-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="size-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}
