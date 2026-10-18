"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, FileQuestion, Pencil, Trash2 } from "lucide-react";
import { deleteInterview, errorMessage, getInterviews, type DocType, type InterviewStages } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { slugify, stagesFromInterview, type Stage } from "@/lib/pipeline";
import { qk } from "@/lib/query-keys";
import { sortJobs, useJobs } from "@/hooks/useJobs";
import { PageContainer, PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { DeleteInterviewDialog } from "@/components/interview/DeleteInterviewDialog";
import { DocumentPane } from "@/components/interview/DocumentPane";
import { InterviewSidebar } from "@/components/interview/InterviewSidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Abas de documento, na ordem em que a leitura costuma acontecer. */
const DOC_TABS: { doc: DocType; label: string }[] = [
  { doc: "structured", label: "Estruturada" },
  { doc: "refined", label: "Refinada" },
  { doc: "raw", label: "Bruta" },
  { doc: "glossary", label: "Glossário" },
];

const isDoc = (value: string | null): value is DocType => DOC_TABS.some((t) => t.doc === value);

/** Documento aberto por padrão: o mais "valioso" que já existe. */
function defaultDoc(stages?: InterviewStages): DocType {
  return DOC_TABS.find((t) => stages?.[t.doc])?.doc ?? "structured";
}

export default function EntrevistaPage() {
  // useSearchParams exige Suspense para não forçar o app inteiro a renderizar só no cliente.
  return (
    <Suspense fallback={<PageContainer><LoadingState lines={6} /></PageContainer>}>
      <EntrevistaView />
    </Suspense>
  );
}

function EntrevistaView() {
  const params = useParams<{ nicho: string; entrevista: string }>();
  const niche = decodeURIComponent(params.nicho);
  const interview = decodeURIComponent(params.entrevista);
  // `key` zera edição e diálogo ao trocar de entrevista, sem efeito de sincronização.
  return <InterviewView key={`${niche}/${interview}`} niche={niche} interview={interview} />;
}

function InterviewView({ niche, interview }: { niche: string; interview: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Dados ──────────────────────────────────────────────────────────────────
  const jobsQuery = useJobs();
  const currentJob = sortJobs(jobsQuery.data ?? []).find(
    (j) => slugify(j.niche) === niche && slugify(j.interview) === interview,
  );
  const running = currentJob?.status === "running";

  const listQuery = useQuery({
    queryKey: qk.interviews(niche),
    queryFn: () => getInterviews(niche),
    staleTime: 10_000,
    refetchInterval: running ? 5_000 : false,
  });
  const summary = listQuery.data?.find((i) => i.name === interview);

  // Quando o job termina, os documentos e a lista de arquivos mudaram.
  const jobStatus = currentJob?.status;
  useEffect(() => {
    if (jobStatus !== "done") return;
    qc.invalidateQueries({ queryKey: qk.interviews(niche) });
    qc.invalidateQueries({ queryKey: ["doc", niche, interview] });
    qc.invalidateQueries({ queryKey: qk.interviewFiles(niche, interview) });
  }, [jobStatus, niche, interview, qc]);

  // Job (com tempos/modelo/logs) enquanto está em memória; senão, os 4 booleanos persistidos.
  const stages: Stage[] = currentJob?.stages.length
    ? currentJob.stages
    : summary
      ? stagesFromInterview(summary.stages)
      : [];

  // ── Documento ativo (na URL: ?doc=) ────────────────────────────────────────
  const requested = searchParams.get("doc");
  const doc: DocType = isDoc(requested) ? requested : defaultDoc(summary?.stages);

  function openDoc(next: DocType) {
    setEditing(false);
    router.replace(`${pathname}?doc=${next}`, { scroll: false });
  }

  // ── Exclusão ───────────────────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: () => deleteInterview(niche, interview),
    onSuccess: () => {
      toast.success(`Entrevista "${interview}" excluída.`);
      qc.invalidateQueries({ queryKey: qk.interviews(niche) });
      qc.invalidateQueries({ queryKey: qk.niches });
      router.push(`/nicho/${encodeURIComponent(niche)}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // ── Estados de página ──────────────────────────────────────────────────────
  if (listQuery.isLoading) {
    return <PageContainer size="wide"><LoadingState lines={8} /></PageContainer>;
  }
  if (listQuery.error) {
    return (
      <PageContainer size="wide">
        <ErrorState title="Não foi possível carregar a entrevista" error={listQuery.error} onRetry={() => listQuery.refetch()} />
      </PageContainer>
    );
  }
  if (!summary) {
    return (
      <PageContainer size="wide">
        <EmptyState
          icon={FileQuestion}
          title="Entrevista não encontrada"
          description={`Não existe "${interview}" no nicho ${niche}. Ela pode ter sido excluída.`}
          action={
            <Link href={`/nicho/${encodeURIComponent(niche)}`} className={buttonVariants({ variant: "outline" })}>
              Voltar ao nicho
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const created = formatDate(summary.created_at);
  const docExists = summary.stages[doc];

  return (
    <PageContainer size="wide">
      <PageHeader
        crumbs={[
          { label: "Início", href: "/dashboard" },
          { label: niche, href: `/nicho/${encodeURIComponent(niche)}` },
          { label: summary.title || interview },
        ]}
        title={summary.title || interview}
        description={[summary.interviewee_name, created].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {docExists && (
              <Button variant={editing ? "secondary" : "outline"} onClick={() => setEditing((e) => !e)}>
                {editing ? <Eye aria-hidden /> : <Pencil aria-hidden />}
                {editing ? "Visualizar" : "Editar"}
              </Button>
            )}
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden /> Excluir
            </Button>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs value={doc} onValueChange={(value) => openDoc(value as DocType)}>
            <TabsList variant="line" className="mb-4">
              {DOC_TABS.map(({ doc: d, label }) => (
                <TabsTrigger key={d} value={d} className={summary.stages[d] ? undefined : "text-muted-foreground/70"}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={doc}>
              <DocumentPane
                niche={niche}
                interview={interview}
                doc={doc}
                editing={editing && docExists}
                onStopEditing={() => setEditing(false)}
              />
            </TabsContent>
          </Tabs>
        </div>

        <aside aria-label="Detalhes da entrevista" className="min-w-0">
          <InterviewSidebar niche={niche} interview={interview} stages={stages} activeDoc={doc} onOpenDoc={openDoc} />
        </aside>
      </div>

      <DeleteInterviewDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        interview={interview}
        niche={niche}
        onConfirm={() => remove.mutate()}
        isDeleting={remove.isPending}
      />
    </PageContainer>
  );
}
