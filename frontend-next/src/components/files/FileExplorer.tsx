"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getInterviewFiles,
  type InterviewSubdir,
  type FileEntry,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { detectKind, formatSize, formatModified } from "@/lib/files";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileAudio,
  FileVideo,
  File as FileIcon,
  Loader2,
} from "lucide-react";

/**
 * Ordem de exibição das subpastas — outputs/glossary primeiro pq são onde
 * o usuário tipicamente gasta mais tempo.
 */
const SUBDIR_ORDER: InterviewSubdir[] = [
  "outputs",
  "glossary",
  "raw",
  "processed",
  "parts",
];

const SUBDIR_LABEL: Record<InterviewSubdir, string> = {
  outputs:   "outputs",
  glossary:  "glossary",
  raw:       "raw (original)",
  processed: "processed",
  parts:     "parts",
};

const SUBDIR_HINT: Record<InterviewSubdir, string> = {
  outputs:   "Markdowns gerados pelo pipeline",
  glossary:  "Glossário local da entrevista",
  raw:       "Arquivo original (preservado sem reencode)",
  processed: "WAV 16kHz mono usado pelo Whisper",
  parts:     "Chunks de até 24MB enviados ao Whisper",
};

function iconFor(name: string) {
  const k = detectKind(name);
  if (k === "markdown") return FileText;
  if (k === "audio")    return FileAudio;
  if (k === "video")    return FileVideo;
  return FileIcon;
}

export function FileExplorer({
  niche,
  interview,
}: {
  niche: string;
  interview: string;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["interview-files", niche, interview],
    queryFn: () => getInterviewFiles(niche, interview),
    staleTime: 10_000,
  });

  // estado de expansão por subpasta. Começa com outputs+glossary abertos.
  const [expanded, setExpanded] = useState<Record<InterviewSubdir, boolean>>({
    outputs:   true,
    glossary:  true,
    raw:       false,
    processed: false,
    parts:     false,
  });

  const currentFile = useAppStore((s) => s.currentFile);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);

  // Reset expand state ao trocar de entrevista
  useEffect(() => {
    setExpanded({
      outputs: true,
      glossary: true,
      raw: false,
      processed: false,
      parts: false,
    });
  }, [niche, interview]);

  function toggle(sub: InterviewSubdir) {
    setExpanded((s) => ({ ...s, [sub]: !s[sub] }));
  }

  function open(sub: InterviewSubdir, f: FileEntry) {
    setCurrentFile({
      subdir: sub,
      name:   f.name,
      kind:   detectKind(f.name),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground/60 italic">
        Não foi possível carregar arquivos.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {SUBDIR_ORDER.map((sub) => {
          const items = data[sub] ?? [];
          const isExpanded = expanded[sub];
          return (
            <div key={sub}>
              <button
                type="button"
                onClick={() => toggle(sub)}
                title={SUBDIR_HINT[sub]}
                className="group flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                )}
                <span className="ml-1 font-medium">{SUBDIR_LABEL[sub]}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/60">
                  {items.length}
                </span>
              </button>

              {isExpanded && (
                <div className="ml-4 mt-0.5 border-l border-border pl-1.5 space-y-0.5">
                  {items.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground/40 italic">
                      vazio
                    </p>
                  ) : (
                    items.map((f) => {
                      const Icon = iconFor(f.name);
                      const active =
                        currentFile?.subdir === sub &&
                        currentFile?.name === f.name;
                      return (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() => open(sub, f)}
                          title={`${f.name} • ${formatSize(f.size)} • ${formatModified(f.modified)}`}
                          className={cn(
                            "group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
                            active
                              ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              active && "text-primary",
                            )}
                          />
                          <span className="truncate flex-1">{f.name}</span>
                          <span className="text-[10px] text-muted-foreground/50 shrink-0">
                            {formatSize(f.size)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
