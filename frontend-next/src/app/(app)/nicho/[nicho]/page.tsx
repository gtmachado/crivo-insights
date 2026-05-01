"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInterviews,
  consolidateInsights,
  consolidateGlossary,
  getConsolidatedInsights,
  getConsolidatedGlossary,
} from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlossaryPanel } from "@/components/glossary/GlossaryPanel";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { AnalyzeNicheButton } from "@/components/niche/AnalyzeNicheButton";
import { NicheAnalysisTab } from "@/components/niche/NicheAnalysisTab";
import {
  Loader2, FileText, CheckCircle2, Clock, Sparkles, BookOpen,
  ChevronRight, AlertCircle, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Stage badges ──────────────────────────────────────────────────────────────

function StageDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
      ok
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        : "bg-muted/40 border-border text-muted-foreground/50"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label}
    </span>
  );
}

// ── Botões legados de consolidação ────────────────────────────────────────────

function ConsolidateButton({
  label, icon: Icon, onClick, isPending, jobId,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  isPending: boolean;
  jobId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="flex items-center gap-2 rounded-md border border-border bg-accent/20 hover:bg-accent px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : (
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span>{isPending ? "Processando…" : label}</span>
      {jobId && (
        <span className="text-[10px] text-muted-foreground font-mono ml-1">#{jobId}</span>
      )}
    </button>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function ConsolidatedInsightsTab({ niche }: { niche: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["consolidated-insights", niche],
    queryFn: () => getConsolidatedInsights(niche),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (isError || !data) return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground text-center">
        Ainda não consolidado. Use o botão acima para gerar.
      </p>
    </div>
  );
  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <MarkdownPreview content={data} />
      </div>
    </ScrollArea>
  );
}

function ConsolidatedGlossaryTab({ niche }: { niche: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["consolidated-glossary", niche],
    queryFn: () => getConsolidatedGlossary(niche),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (isError || !data) return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground text-center">
        Ainda não consolidado. Use o botão acima para gerar.
      </p>
    </div>
  );
  return <GlossaryPanel markdown={data} />;
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function NichoPage() {
  const params = useParams<{ nicho: string }>();
  const niche = decodeURIComponent(params.nicho);
  const qc = useQueryClient();

  const [insightsJobId, setInsightsJobId] = useState<string | undefined>();
  const [glossaryJobId, setGlossaryJobId] = useState<string | undefined>();

  // Seleção da Fase 4. Set<slug>. Reset quando muda o nicho.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setSelected(new Set());
  }, [niche]);

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["interviews", niche],
    queryFn: () => getInterviews(niche),
    staleTime: 10_000,
  });

  // Apenas entrevistas com 03_estruturada.md são candidatas válidas pra análise.
  const eligible = useMemo(
    () => interviews.filter((iv) => iv.stages?.structured),
    [interviews],
  );
  const eligibleNames = useMemo(
    () => new Set(eligible.map((iv) => iv.name)),
    [eligible],
  );

  // Mantém apenas entrevistas elegíveis na seleção (filtra automaticamente
  // se uma deixou de ser elegível por ex.)
  useEffect(() => {
    setSelected((cur) => {
      const next = new Set<string>();
      cur.forEach((s) => { if (eligibleNames.has(s)) next.add(s); });
      return next.size === cur.size ? cur : next;
    });
  }, [eligibleNames]);

  const allEligibleSelected =
    eligible.length > 0 && eligible.every((iv) => selected.has(iv.name));

  function toggleOne(name: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelected((cur) => {
      if (allEligibleSelected) return new Set();
      return new Set(eligible.map((iv) => iv.name));
    });
  }

  const consolidateInsightsMutation = useMutation({
    mutationFn: () => consolidateInsights(niche),
    onSuccess: (data) => {
      setInsightsJobId(data.job_id);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["consolidated-insights", niche] });
      }, 10_000);
    },
  });

  const consolidateGlossaryMutation = useMutation({
    mutationFn: () => consolidateGlossary(niche),
    onSuccess: (data) => {
      setGlossaryJobId(data.job_id);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["consolidated-glossary", niche] });
      }, 10_000);
    },
  });

  const total = interviews.length;
  const withRaw        = interviews.filter((iv) => iv.stages?.raw).length;
  const withStructured = eligible.length;
  const withGlossary   = interviews.filter((iv) => iv.stages?.glossary).length;
  const selectedSlugs  = useMemo(() => Array.from(selected), [selected]);

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden">
      {/* Lista de entrevistas (esquerda) */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold truncate gradient-text">{niche}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} entrevista{total !== 1 ? "s" : ""}
            {" · "}{withStructured} estruturada{withStructured !== 1 ? "s" : ""}
            {" · "}{withGlossary} com glossário
          </p>

          {eligible.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <SelectionCheckbox
                checked={allEligibleSelected}
                indeterminate={selected.size > 0 && !allEligibleSelected}
              />
              <span>
                {allEligibleSelected
                  ? "Desmarcar todas"
                  : selected.size > 0
                    ? `${selected.size} de ${eligible.length} selecionada${selected.size > 1 ? "s" : ""}`
                    : "Selecionar todas"}
              </span>
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 p-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : total === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic text-center py-8">
              Nenhuma entrevista neste nicho.
            </p>
          ) : (
            <div className="space-y-1">
              {interviews.map((iv) => {
                const href = `/nicho/${encodeURIComponent(niche)}/${encodeURIComponent(iv.name)}`;
                const isEligible = eligibleNames.has(iv.name);
                const isSelected = selected.has(iv.name);
                return (
                  <div
                    key={iv.name}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-md px-3 py-2 transition-colors group",
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent border border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => isEligible && toggleOne(iv.name)}
                        disabled={!isEligible}
                        title={
                          isEligible
                            ? "Incluir/excluir esta entrevista da análise"
                            : "Sem 03_estruturada.md — não pode entrar na análise"
                        }
                        aria-label={`Selecionar ${iv.name}`}
                        className={cn(
                          "shrink-0",
                          !isEligible && "opacity-30 cursor-not-allowed",
                        )}
                      >
                        <SelectionCheckbox checked={isSelected} disabled={!isEligible} />
                      </button>
                      <Link
                        href={href}
                        className="flex-1 min-w-0 flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate text-foreground/80 group-hover:text-foreground">
                          {iv.name}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/40 shrink-0" />
                      </Link>
                    </div>
                    {iv.stages && (
                      <div className="flex flex-wrap gap-1 ml-7">
                        <StageDot ok={iv.stages.raw}        label="Bruta"     />
                        <StageDot ok={iv.stages.refined}    label="Refinada"  />
                        <StageDot ok={iv.stages.structured} label="Estrut."   />
                        <StageDot ok={iv.stages.glossary}   label="Glossário" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Painel direito */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-primary" />
              Análise do nicho
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecione entrevistas e rode Claude Sonnet 4.6 para gerar uma
              análise consolidada.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs">
              {withRaw}/{total} transcritas
            </Badge>
          </div>
        </div>

        {/* Barra de ação principal — Fase 4 */}
        <div className="px-6 py-3 border-b border-border shrink-0 flex flex-wrap items-center gap-3">
          <AnalyzeNicheButton
            niche={niche}
            selectedSlugs={selectedSlugs}
            totalCount={withStructured}
          />

          <div className="h-5 w-px bg-border mx-1" aria-hidden />

          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Consolidações automáticas
          </span>
          <ConsolidateButton
            label="Consolidar Insights"
            icon={Sparkles}
            onClick={() => consolidateInsightsMutation.mutate()}
            isPending={consolidateInsightsMutation.isPending}
            jobId={insightsJobId}
          />
          <ConsolidateButton
            label="Consolidar Glossário"
            icon={BookOpen}
            onClick={() => consolidateGlossaryMutation.mutate()}
            isPending={consolidateGlossaryMutation.isPending}
            jobId={glossaryJobId}
          />
        </div>

        <Tabs defaultValue="analysis" className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-3 shrink-0 flex items-center justify-between gap-2">
            <TabsList className="h-8">
              <TabsTrigger value="analysis" className="text-xs px-4">
                <Brain className="h-3.5 w-3.5 mr-1.5" />
                Análise
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-xs px-4">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Insights consolidados
              </TabsTrigger>
              <TabsTrigger value="glossary" className="text-xs px-4">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                Glossário
              </TabsTrigger>
            </TabsList>

            <Link
              href={`/nicho/${encodeURIComponent(niche)}/glossario`}
              title="Abrir glossário consolidado em página completa"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Glossário em página completa</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="analysis" className="h-full m-0 data-[state=active]:flex flex-col">
              <NicheAnalysisTab
                niche={niche}
                hasInterviewsSelected={selected.size > 0}
              />
            </TabsContent>
            <TabsContent value="insights" className="h-full m-0 data-[state=active]:flex flex-col">
              <ConsolidatedInsightsTab niche={niche} />
            </TabsContent>
            <TabsContent value="glossary" className="h-full m-0 data-[state=active]:flex flex-col overflow-hidden">
              <ConsolidatedGlossaryTab niche={niche} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ── Checkbox visual ───────────────────────────────────────────────────────────

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded border transition-colors",
        checked || indeterminate
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-background border-muted-foreground/40",
        disabled && "opacity-40",
      )}
    >
      {indeterminate ? (
        <span className="block h-0.5 w-2 bg-current rounded-sm" />
      ) : checked ? (
        <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
      ) : null}
    </span>
  );
}
