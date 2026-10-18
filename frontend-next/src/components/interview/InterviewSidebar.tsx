"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInterviewFiles, type DocType, type FileEntry, type InterviewFiles, type InterviewSubdir } from "@/lib/api";
import { FILENAME_TO_DOC, detectKind } from "@/lib/files";
import type { Stage } from "@/lib/pipeline";
import { qk } from "@/lib/query-keys";
import { SectionLabel } from "@/components/common/PageHeader";
import { FileExplorer } from "@/components/files/FileExplorer";
import { MediaPlayer } from "@/components/media/MediaPlayer";
import { PipelineTimeline } from "@/components/pipeline/PipelineTimeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InterviewMeta } from "./InterviewMeta";

type Media = { subdir: InterviewSubdir; file: FileEntry; kind: "audio" | "video" };

/** Arquivos tocáveis: original primeiro, depois o WAV processado. */
function mediaFiles(files: InterviewFiles): Media[] {
  const out: Media[] = [];
  for (const subdir of ["raw", "processed"] as const) {
    for (const file of files[subdir] ?? []) {
      const kind = detectKind(file.name);
      if (kind === "audio" || kind === "video") out.push({ subdir, file, kind });
    }
  }
  return out;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

function MediaSection({
  niche,
  interview,
  files,
  selected,
  onSelect,
}: {
  niche: string;
  interview: string;
  files: InterviewFiles;
  selected: string | null;
  onSelect: (filename: string) => void;
}) {
  const media = mediaFiles(files);
  const current = media.find((m) => m.file.name === selected) ?? media[0];

  if (!current) {
    return <p className="text-sm text-muted-foreground">Nenhuma gravação disponível.</p>;
  }

  return (
    <div className="space-y-3">
      {media.length > 1 && (
        <Select
          value={current.file.name}
          onValueChange={(value) => onSelect(String(value))}
          items={media.map((m) => ({ value: m.file.name, label: m.file.name }))}
        >
          <SelectTrigger size="sm" className="w-full" aria-label="Arquivo de mídia">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {media.map((m) => (
              <SelectItem key={m.file.name} value={m.file.name}>
                {m.file.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <MediaPlayer niche={niche} interview={interview} filename={current.file.name} size={current.file.size} kind={current.kind} />
    </div>
  );
}

/**
 * Coluna lateral da entrevista: gravação, andamento do pipeline, dados e
 * arquivos. A navegação entre documentos fica nas abas da área de leitura.
 */
export function InterviewSidebar({
  niche,
  interview,
  stages,
  activeDoc,
  onOpenDoc,
}: {
  niche: string;
  interview: string;
  stages: Stage[];
  activeDoc: DocType;
  onOpenDoc: (doc: DocType) => void;
}) {
  const filesQuery = useQuery({
    queryKey: qk.interviewFiles(niche, interview),
    queryFn: () => getInterviewFiles(niche, interview),
    staleTime: 10_000,
  });
  const files = filesQuery.data;
  const [mediaName, setMediaName] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <Section title="Gravação">
        {files ? (
          <MediaSection niche={niche} interview={interview} files={files} selected={mediaName} onSelect={setMediaName} />
        ) : (
          <p className="text-sm text-muted-foreground">{filesQuery.isError ? "Não foi possível listar os arquivos." : "Carregando…"}</p>
        )}
      </Section>

      {stages.length > 0 && (
        <Section title="Pipeline">
          <PipelineTimeline stages={stages} orientation="vertical" />
        </Section>
      )}

      <Section title="Dados da entrevista">
        <InterviewMeta niche={niche} interview={interview} />
      </Section>

      {files && (
        <Section title="Arquivos">
          <FileExplorer
            files={files}
            activeName={Object.entries(FILENAME_TO_DOC).find(([, d]) => d === activeDoc)?.[0]}
            onOpen={(_, file) => {
              const doc = FILENAME_TO_DOC[file.name];
              if (doc) onOpenDoc(doc);
              else if (detectKind(file.name) !== "markdown") setMediaName(file.name);
            }}
          />
        </Section>
      )}
    </div>
  );
}
