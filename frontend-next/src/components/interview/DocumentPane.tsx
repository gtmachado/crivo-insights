"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { ApiError, getDocument, updateDocument, type DocType } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { GlossaryGrid } from "@/components/glossary/GlossaryGrid";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { buttonVariants } from "@/components/ui/button";

/**
 * Painel de leitura (ou edição) de um documento da entrevista.
 * "Ainda não gerado" (404) e falha de verdade são estados diferentes.
 */
export function DocumentPane({
  niche,
  interview,
  doc,
  editing,
  onStopEditing,
}: {
  niche: string;
  interview: string;
  doc: DocType;
  editing: boolean;
  onStopEditing: () => void;
}) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: qk.doc(niche, interview, doc),
    queryFn: () => getDocument(niche, interview, doc),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const save = useMutation({
    mutationFn: (content: string) => updateDocument(niche, interview, doc, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.doc(niche, interview, doc) });
      qc.invalidateQueries({ queryKey: qk.interviewFiles(niche, interview) });
      qc.invalidateQueries({ queryKey: qk.interviews(niche) });
      onStopEditing();
    },
  });

  if (query.isLoading) return <LoadingState lines={8} />;

  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          icon={FileText}
          title="Documento ainda não gerado"
          description="Ele aparece aqui assim que o pipeline terminar esta etapa."
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const content = query.data ?? "";

  if (editing) {
    return (
      <MarkdownEditor
        key={doc}
        initialContent={content}
        filename={doc}
        saving={save.isPending}
        onSave={async (value) => {
          await save.mutateAsync(value);
        }}
        onCancel={onStopEditing}
      />
    );
  }

  if (doc === "glossary") {
    const printHref = `/nicho/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/glossario/print`;
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <a href={printHref} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Printer aria-hidden /> Exportar PDF
          </a>
        </div>
        <GlossaryGrid markdown={content} />
      </div>
    );
  }

  return (
    <article className="rounded-xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:px-10 sm:py-8">
      <MarkdownPreview content={content} />
    </article>
  );
}
