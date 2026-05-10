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
  type Interview,
} from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlossaryPanel } from "@/components/glossary/GlossaryPanel";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { AnalyzeNicheButton } from "@/components/niche/AnalyzeNicheButton";
import { NicheAnalysisTab } from "@/components/niche/NicheAnalysisTab";
import {
  Loader2, FileText, CheckCircle2, Clock, Sparkles, BookOpen,
  ChevronRight, AlertCircle, Brain, ListChecks, Archive,
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
      className="flex items-center gap-2 rounded-md border border-border bg-background hover:bg-accent px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  const [selectionOpen, setSelectionOpen] = useState(false);

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
                return (
                  <div
                    key={iv.name}
                    className="flex flex-col gap-1.5 rounded-md border border-transparent px-3 py-2 transition-colors group hover:bg-accent"
                  >
                    <div className="flex items-center gap-2 min-w-0">
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
              Análise
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use cada entrevista para extrair insights individuais. Use esta
              visão para analisar o nicho com múltiplas entrevistas estruturadas.
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
          {selectedSlugs.length > 0 ? (
            <>
              <AnalyzeNicheButton
                niche={niche}
                selectedSlugs={selectedSlugs}
                totalCount={withStructured}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectionOpen(true)}
                className="gap-2"
              >
                <ListChecks className="h-4 w-4" />
                Alterar entrevistas
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => setSelectionOpen(true)}
              className="gap-2 gradient-bg text-white border-0 hover:opacity-90 glow-soft"
            >
              <Brain className="h-4 w-4" />
              Analisar nicho
            </Button>
          )}

          <Badge variant="secondary" className="text-xs">
            {selectedSlugs.length > 0
              ? `${selectedSlugs.length}/${withStructured} selecionada${selectedSlugs.length > 1 ? "s" : ""}`
              : `${withStructured} elegível${withStructured !== 1 ? "s" : ""}`}
          </Badge>

          <details className="ml-auto group rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-xs">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Archive className="h-3.5 w-3.5" />
              Ações legadas
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <ConsolidateButton
                label="Insights"
                icon={Sparkles}
                onClick={() => consolidateInsightsMutation.mutate()}
                isPending={consolidateInsightsMutation.isPending}
                jobId={insightsJobId}
              />
              <ConsolidateButton
                label="Glossário"
                icon={BookOpen}
                onClick={() => consolidateGlossaryMutation.mutate()}
                isPending={consolidateGlossaryMutation.isPending}
                jobId={glossaryJobId}
              />
            </div>
          </details>
        </div>

        <Tabs defaultValue="analysis" className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-3 shrink-0 flex items-center justify-between gap-2">
            <TabsList className="h-8">
              <TabsTrigger value="analysis" className="text-xs px-4">
                <Brain className="h-3.5 w-3.5 mr-1.5" />
                Análise
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-xs px-4">
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Insights legados
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

      <AnalysisSelectionDialog
        open={selectionOpen}
        onClose={() => setSelectionOpen(false)}
        eligible={eligible}
        selected={selected}
        allEligibleSelected={allEligibleSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}

// ── Seleção sob demanda ───────────────────────────────────────────────────────

function AnalysisSelectionDialog({
  open,
  onClose,
  eligible,
  selected,
  allEligibleSelected,
  onToggleAll,
  onToggleOne,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  eligible: Interview[];
  selected: Set<string>;
  allEligibleSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (name: string) => void;
  onClear: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl p-0 overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Analisar nicho</h2>
            <p className="text-xs text-muted-foreground">
              Escolha entrevistas estruturadas para uma análise multi-entrevista.
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleAll}
          disabled={eligible.length === 0}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SelectionCheckbox
            checked={allEligibleSelected}
            indeterminate={selected.size > 0 && !allEligibleSelected}
            disabled={eligible.length === 0}
          />
          <span>
            {allEligibleSelected
              ? "Desmarcar todas"
              : selected.size > 0
                ? `${selected.size} de ${eligible.length} selecionada${selected.size > 1 ? "s" : ""}`
                : "Selecionar todas"}
          </span>
        </button>

        <Badge variant="secondary" className="text-xs">
          {eligible.length} elegível{eligible.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <ScrollArea className="max-h-[55vh]">
        <div className="p-3">
          {eligible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <AlertCircle className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm font-medium">Nenhuma entrevista elegível</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                A análise de nicho usa apenas entrevistas com o arquivo estruturado.
                Extraia insights na página da entrevista antes de analisar o nicho.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {eligible.map((iv) => {
                const isSelected = selected.has(iv.name);

                return (
                  <button
                    key={iv.name}
                    type="button"
                    onClick={() => onToggleOne(iv.name)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                      isSelected
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent hover:bg-accent",
                    )}
                  >
                    <SelectionCheckbox checked={isSelected} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground/85">
                        {iv.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pronta para análise de nicho
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
        <Button type="button" variant="ghost" onClick={onClear} disabled={selected.size === 0}>
          Limpar
        </Button>
        <Button type="button" onClick={onClose} disabled={selected.size === 0}>
          Confirmar seleção
        </Button>
      </div>
    </Dialog>
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
