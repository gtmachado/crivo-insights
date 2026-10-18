"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, File as FileIcon, FileAudio, FileText, FileVideo } from "lucide-react";
import type { FileEntry, InterviewFiles, InterviewSubdir } from "@/lib/api";
import { detectKind, formatModified, formatSize } from "@/lib/files";
import { cn } from "@/lib/utils";

const SUBDIR_ORDER: InterviewSubdir[] = ["outputs", "glossary", "raw", "processed", "parts"];

const SUBDIR_LABEL: Record<InterviewSubdir, string> = {
  outputs:   "Documentos",
  glossary:  "Glossário",
  raw:       "Original",
  processed: "Processado",
  parts:     "Partes",
};

const SUBDIR_HINT: Record<InterviewSubdir, string> = {
  outputs:   "Markdowns gerados pelo pipeline",
  glossary:  "Glossário local da entrevista",
  raw:       "Arquivo original (preservado sem reencode)",
  processed: "WAV 16kHz mono usado pelo Whisper",
  parts:     "Trechos enviados ao Whisper",
};

const ICON = { markdown: FileText, audio: FileAudio, video: FileVideo, other: FileIcon } as const;

/**
 * Lista os arquivos da entrevista por subpasta. É só apresentação: quem
 * decide o que fazer ao abrir um arquivo é a página (`onOpen`).
 */
export function FileExplorer({
  files,
  activeName,
  onOpen,
}: {
  files: InterviewFiles;
  activeName?: string;
  onOpen: (subdir: InterviewSubdir, file: FileEntry) => void;
}) {
  const [expanded, setExpanded] = useState<Record<InterviewSubdir, boolean>>({
    outputs: true, glossary: true, raw: false, processed: false, parts: false,
  });

  return (
    <div className="space-y-1">
      {SUBDIR_ORDER.map((sub) => {
        const items = files[sub] ?? [];
        const open = expanded[sub];
        const Chevron = open ? ChevronDown : ChevronRight;
        return (
          <div key={sub}>
            <button
              type="button"
              aria-expanded={open}
              title={SUBDIR_HINT[sub]}
              onClick={() => setExpanded((s) => ({ ...s, [sub]: !s[sub] }))}
              className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Chevron className="size-3 shrink-0" aria-hidden />
              <span className="font-medium">{SUBDIR_LABEL[sub]}</span>
              <span className="ml-auto text-2xs tabular-nums">{items.length}</span>
            </button>

            {open && (
              <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-1.5">
                {items.length === 0 ? (
                  <li className="px-2 py-1 text-2xs italic text-muted-foreground">vazio</li>
                ) : (
                  items.map((f) => {
                    const Icon = ICON[detectKind(f.name)];
                    const active = f.name === activeName;
                    return (
                      <li key={f.name}>
                        <button
                          type="button"
                          onClick={() => onOpen(sub, f)}
                          title={`${f.name} · ${formatSize(f.size)} · ${formatModified(f.modified)}`}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Icon className="size-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <span className="shrink-0 text-2xs tabular-nums opacity-70">{formatSize(f.size)}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
