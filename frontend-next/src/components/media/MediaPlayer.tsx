"use client";

import { mediaUrl } from "@/lib/api";
import { formatSize } from "@/lib/files";
import { FileAudio, FileVideo, Download } from "lucide-react";

/**
 * Player condicional de mídia. Aparece SOMENTE quando uma faixa de
 * áudio ou vídeo é selecionada no FileExplorer — não fica fixo na tela.
 *
 * Toca o arquivo ORIGINAL servido pelo backend (sem transcoding). O
 * `<audio>` e `<video>` do navegador suportam Range requests que o
 * FileResponse do FastAPI já oferece, então seek funciona em vídeos longos.
 *
 * O áudio recebe estilo "card" centralizado; vídeo vai full no container.
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

  if (kind === "video") {
    return (
      <div className="flex flex-col h-full bg-black/40">
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-background/50 flex items-center gap-2 shrink-0">
          <FileVideo className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">{filename}</span>
          {size !== undefined && (
            <span className="ml-auto text-muted-foreground/60">
              {formatSize(size)}
            </span>
          )}
          <a
            href={src}
            download={filename}
            className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Baixar arquivo original"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
        {/* key força remontagem ao trocar de arquivo (evita reuso de buffer) */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <video
            key={src}
            src={src}
            controls
            playsInline
            preload="metadata"
            className="max-h-full max-w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-background/50 flex items-center gap-2 shrink-0">
        <FileAudio className="h-3.5 w-3.5 text-primary" />
        <span className="truncate">{filename}</span>
        {size !== undefined && (
          <span className="ml-auto text-muted-foreground/60">
            {formatSize(size)}
          </span>
        )}
        <a
          href={src}
          download={filename}
          className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Baixar arquivo original"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        {/* Disco/visual */}
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40 gradient-bg"
            aria-hidden
          />
          <div className="relative h-32 w-32 rounded-full glass flex items-center justify-center glow-primary">
            <FileAudio className="h-12 w-12 text-primary" />
          </div>
        </div>

        <p className="text-sm font-medium text-center max-w-md break-all">
          {filename}
        </p>

        <audio
          key={src}
          src={src}
          controls
          preload="metadata"
          className="w-full max-w-lg"
        />
      </div>
    </div>
  );
}
