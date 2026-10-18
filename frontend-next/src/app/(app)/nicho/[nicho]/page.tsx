"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Mic2, Plus, Sparkles } from "lucide-react";
import { getInterviews } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useAnalyzeNiche } from "@/hooks/useAnalyzeNiche";
import { PageContainer, PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { InterviewTable } from "@/components/niche/InterviewTable";
import { NicheAnalysisTab } from "@/components/niche/NicheAnalysisTab";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NichoPage() {
  const params = useParams<{ nicho: string }>();
  const niche = decodeURIComponent(params.nicho);
  // `key` zera a seleção e a aba ao trocar de nicho, sem efeito de sincronização.
  return <NicheView key={niche} niche={niche} />;
}

function NicheView({ niche }: { niche: string }) {
  const [tab, setTab] = useState("interviews");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const analysis = useAnalyzeNiche(niche);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.interviews(niche),
    queryFn: () => getInterviews(niche),
    staleTime: 10_000,
  });
  const interviews = data ?? [];

  // Só entrevistas com o documento estruturado entram na análise.
  const eligible = interviews.filter((i) => i.stages.structured);
  const selectedSlugs = eligible.map((i) => i.name).filter((name) => selected.has(name));
  const allSelected = eligible.length > 0 && selectedSlugs.length === eligible.length;

  const toggle = (name: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(eligible.map((i) => i.name)));

  return (
    <PageContainer>
      <PageHeader
        crumbs={[{ label: "Início", href: "/dashboard" }, { label: niche }]}
        title={niche}
        description={
          isLoading
            ? undefined
            : `${interviews.length} ${interviews.length === 1 ? "entrevista" : "entrevistas"} · ${eligible.length} com documento estruturado`
        }
        actions={
          <Link href={`/upload?niche=${encodeURIComponent(niche)}`} className={buttonVariants({ variant: "outline" })}>
            <Plus aria-hidden /> Nova entrevista
          </Link>
        }
      />

      {analysis.isRunning && (
        <p role="status" className={cn("mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm", TONE.info.soft)}>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Gerando a análise do nicho com Claude Sonnet 4.6… pode levar alguns minutos.
        </p>
      )}
      {analysis.failure && (
        <p role="alert" className={cn("mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm", TONE.danger.soft)}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{analysis.failure}</span>
        </p>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="interviews">
            Entrevistas
            {!isLoading && <span className="ml-1 text-2xs tabular-nums text-muted-foreground">{interviews.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="analysis">Análise</TabsTrigger>
        </TabsList>

        <TabsContent value="interviews" className="space-y-4">
          {isLoading ? (
            <LoadingState lines={5} />
          ) : error ? (
            <ErrorState title="Não foi possível carregar as entrevistas" error={error} onRetry={() => refetch()} />
          ) : interviews.length === 0 ? (
            <EmptyState
              icon={Mic2}
              title="Nenhuma entrevista neste nicho"
              description="Envie uma gravação de áudio ou vídeo; o pipeline transcreve, refina e estrutura."
              action={
                <Link href={`/upload?niche=${encodeURIComponent(niche)}`} className={buttonVariants()}>
                  Nova entrevista
                </Link>
              }
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Marque as entrevistas estruturadas que devem entrar na análise do nicho.
              </p>
              <InterviewTable
                niche={niche}
                interviews={interviews}
                selected={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="analysis">
          <NicheAnalysisTab niche={niche} onGoToInterviews={() => setTab("interviews")} />
        </TabsContent>
      </Tabs>

      {selectedSlugs.length > 0 && (
        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-popover p-3 pl-4 shadow-lg ring-1 ring-foreground/15">
          <p className="text-sm">
            <span className="font-medium tabular-nums">{selectedSlugs.length}</span>{" "}
            de {eligible.length} {selectedSlugs.length === 1 ? "selecionada" : "selecionadas"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
            <Button
              disabled={analysis.isRunning}
              title="Roda Claude Sonnet 4.6 sobre as entrevistas selecionadas"
              onClick={() => {
                analysis.start(selectedSlugs);
                setTab("analysis");
              }}
            >
              {analysis.isRunning ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {analysis.isRunning ? "Analisando…" : "Gerar análise"}
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
