"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDocument,
  getInterviewFiles,
  getInterviews,
  getAllJobs,
  updateDocument,
  deleteInterview,
  type DocType,
  type EditableDocType,
  type InterviewSubdir,
  type Job,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { FILENAME_TO_DOC } from "@/lib/files";
import {
  type Stage,
  stagesFromInterview,
  slugify,
} from "@/lib/pipeline";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { MediaPlayer } from "@/components/media/MediaPlayer";
import { FileExplorer } from "@/components/files/FileExplorer";
import { InterviewHeader } from "@/components/interview/InterviewHeader";
import { InterviewMeta } from "@/components/interview/InterviewMeta";
import { DeleteInterviewDialog } from "@/components/interview/DeleteInterviewDialog";
import { PipelineTimeline } from "@/components/pipeline/PipelineTimeline";
import { Loader2, FileText, FolderOpen, BookOpen } from "lucide-react";
import { toast } from "sonner";

const EDITABLE_DOCS: readonly DocType[] = ["raw", "refined", "structured", "glossary"];

/**
 * Fallback de auto-abertura ao entrar na página: prioriza o markdown mais
 * "alto-valor" disponível.
 */
const AUTO_OPEN_PRIORITY: ReadonlyArray<{ subdir: InterviewSubdir; name: string }> = [
  { subdir: "outputs",  name: "03_entrevista_estruturada.md" },
  { subdir: "outputs",  name: "02_transcricao_refinada.md"   },
  { subdir: "outputs",  name: "01_transcricao_bruta.md"      },
];

export default function EntrevistaPage() {
  const params = useParams<{ nicho: string; entrevista: string }>();
  const router = useRouter();
  const niche     = decodeURIComponent(params.nicho);
  const interview = decodeURIComponent(params.entrevista);
  const qc = useQueryClient();

  const currentFile    = useAppStore((s) => s.currentFile);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);

  const [editing,    setEditing]    = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Reset state ao trocar de entrevista
  useEffect(() => {
    setCurrentFile(null);
    setEditing(false);
    setDeleteOpen(false);
  }, [niche, interview, setCurrentFile]);

  // Sair do modo edição quando trocar de arquivo
  useEffect(() => {
    setEditing(false);
  }, [currentFile?.subdir, currentFile?.name]);

  // ── Files ──────────────────────────────────────────────────────────────────

  const filesQuery = useQuery({
    queryKey: ["interview-files", niche, interview],
    queryFn: () => getInterviewFiles(niche, interview),
    staleTime: 10_000,
  });

  // Auto-abre o doc mais relevante quando os arquivos carregam
  useEffect(() => {
    if (currentFile || !filesQuery.data) return;
    for (const c of AUTO_OPEN_PRIORITY) {
      if (filesQuery.data[c.subdir]?.some((f) => f.name === c.name)) {
        setCurrentFile({ subdir: c.subdir, name: c.name, kind: "markdown" });
        return;
      }
    }
  }, [currentFile, filesQuery.data, setCurrentFile]);

  // ── Pipeline timeline ──────────────────────────────────────────────────────
  // Duas fontes de verdade:
  //   1) /pipeline/jobs → stages estruturados COM tempos/modelo/logs
  //      (somente enquanto o job está em memória)
  //   2) /interviews/{niche} → 4 booleans (raw/refined/structured/glossary)
  //      stagesFromInterview() converte em timeline simples
  // Polling adaptativo: 3s se houver job rodando da entrevista, 30s caso contrário.

  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: getAllJobs,
    refetchInterval: (q) => {
      const data = q.state.data as Job[] | undefined;
      const hasRunning = data?.some(
        (j) =>
          j.status === "running" &&
          slugify(j.niche) === niche &&
          slugify(j.interview) === interview,
      );
      return hasRunning ? 3000 : 30_000;
    },
  });

  const interviewsListQuery = useQuery({
    queryKey: ["interviews", niche],
    queryFn: () => getInterviews(niche),
    staleTime: 10_000,
  });

  const stages = useMemo<Stage[]>(() => {
    // 1) job ativo (preferido — tem tempos e modelo reais)
    const matchingJob = jobsQuery.data?.find(
      (j) =>
        slugify(j.niche) === niche && slugify(j.interview) === interview,
    );
    if (matchingJob?.stages?.length) {
      return matchingJob.stages as Stage[];
    }
    // 2) fallback baseado nos booleans persistidos
    const ivData = interviewsListQuery.data?.find(
      (i) => i.name === interview,
    );
    if (ivData?.stages) {
      return stagesFromInterview(ivData.stages);
    }
    return [];
  }, [jobsQuery.data, interviewsListQuery.data, niche, interview]);

  // Job atual da entrevista (se houver) — usado pra status pill e link de log
  const currentJob = useMemo<Job | undefined>(
    () =>
      jobsQuery.data?.find(
        (j) =>
          slugify(j.niche) === niche && slugify(j.interview) === interview,
      ),
    [jobsQuery.data, niche, interview],
  );

  // ── Doc atual (lookup do conteúdo do arquivo selecionado) ──────────────────

  const docType: DocType | undefined = useMemo(() => {
    if (!currentFile || currentFile.kind !== "markdown") return undefined;
    return FILENAME_TO_DOC[currentFile.name];
  }, [currentFile]);

  const canEdit =
    !!docType && (EDITABLE_DOCS as readonly DocType[]).includes(docType);

  const docQuery = useQuery({
    queryKey: ["doc", niche, interview, docType],
    queryFn: () => getDocument(niche, interview, docType as DocType),
    enabled: !!docType,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: (content: string) =>
      updateDocument(niche, interview, docType as EditableDocType, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc", niche, interview, docType] });
      qc.invalidateQueries({ queryKey: ["interview-files", niche, interview] });
      qc.invalidateQueries({ queryKey: ["interviews", niche] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInterview(niche, interview),
    onSuccess: () => {
      toast.success(`Entrevista "${interview}" excluída.`);
      qc.invalidateQueries({ queryKey: ["interviews", niche] });
      qc.invalidateQueries({ queryKey: ["niches"] });
      router.push(`/nicho/${encodeURIComponent(niche)}`);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro ao excluir.";
      toast.error(msg);
    },
  });

  // ── Render do viewer central ───────────────────────────────────────────────

  function renderViewer() {
    if (!currentFile) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Selecione um arquivo no explorador à esquerda.
          </p>
        </div>
      );
    }

    if (currentFile.kind === "audio" || currentFile.kind === "video") {
      const fileEntry = filesQuery.data?.[currentFile.subdir]?.find(
        (f) => f.name === currentFile.name,
      );
      return (
        <MediaPlayer
          niche={niche}
          interview={interview}
          filename={currentFile.name}
          size={fileEntry?.size}
          kind={currentFile.kind}
        />
      );
    }

    if (currentFile.kind === "markdown") {
      // Sem mapeamento conhecido → não temos endpoint pra ler genericamente
      if (!docType) {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Este arquivo não é um doc gerenciado pelo pipeline.
            </p>
            <p className="text-xs text-muted-foreground/60 font-mono">
              {currentFile.subdir}/{currentFile.name}
            </p>
          </div>
        );
      }

      if (docQuery.isLoading) {
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        );
      }

      if (docQuery.isError || !docQuery.data) {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Documento ainda não gerado.
            </p>
          </div>
        );
      }

      if (editing && canEdit) {
        return (
          <MarkdownEditor
            initialContent={docQuery.data}
            filename={currentFile.name}
            onSave={async (c) => {
              await updateMutation.mutateAsync(c);
            }}
            onCancel={() => setEditing(false)}
            saving={updateMutation.isPending}
          />
        );
      }

      return (
        <ScrollArea className="h-full">
          <div className="p-6">
            <MarkdownPreview content={docQuery.data} />
          </div>
        </ScrollArea>
      );
    }

    // Tipo "other" — sem viewer ainda (fase 1 não implementa)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Este tipo de arquivo não tem visualização nesta versão.
        </p>
        <p className="text-xs text-muted-foreground/60 font-mono">
          {currentFile.subdir}/{currentFile.name}
        </p>
      </div>
    );
  }

  // ── Layout: 3 colunas (FileExplorer | Viewer | GlossaryPanel) ──────────────

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Esquerda: explorador de arquivos */}
      <aside className="w-60 shrink-0 border-r border-border flex flex-col overflow-hidden bg-background/30 backdrop-blur-sm">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Arquivos
          </p>
        </div>
        <FileExplorer niche={niche} interview={interview} />
      </aside>

      {/* Centro: viewer */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border min-w-0">
        <InterviewHeader
          niche={niche}
          interview={interview}
          currentFileName={currentFile?.name}
          editing={editing}
          canEdit={canEdit}
          onToggleEdit={() => setEditing((e) => !e)}
          onDelete={() => setDeleteOpen(true)}
        />

        {/* Timeline horizontal do pipeline. Sempre visível, com expansão de
            detalhes inline. Aparece "rica" (com tempos/logs/modelo) durante
            jobs ativos; depois vira modo simplificado com base nos booleans. */}
        {stages.length > 0 && (
          <div className="px-5 py-3 border-b border-border bg-background/30 backdrop-blur-sm shrink-0">
            <PipelineTimeline
              stages={stages}
              orientation="horizontal"
              expandable
              showLabels
              showDurations={!!currentJob}
            />
          </div>
        )}

        {/* Metadata da entrevista (entrevistado, entrevistador, etc.) */}
        <InterviewMeta niche={niche} interview={interview} />

        {/* Link para o glossário completo — visível quando o arquivo existe */}
        {filesQuery.data?.glossary?.some((f) => f.name === "glossario_local.md") && (
          <div className="shrink-0 px-1 pb-1">
            <Link
              href={`/nicho/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/glossario`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Ver glossário da entrevista
            </Link>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">{renderViewer()}</div>
      </div>

      {/* Delete dialog */}
      <DeleteInterviewDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        interview={interview}
        niche={niche}
        onConfirm={() => deleteMutation.mutate()}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
