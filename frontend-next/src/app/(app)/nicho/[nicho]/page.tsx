"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlossaryPanel } from "@/components/glossary/GlossaryPanel";
import {
  Loader2, FileText, CheckCircle2, Clock, Sparkles, BookOpen,
  ChevronRight, AlertCircle,
} from "lucide-react";

// ── Markdown viewer simples ───────────────────────────────────────────────────

function MarkdownViewer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      {lines.map((line, i) => {
        if (line.startsWith("# "))   return <h1 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
        if (line.startsWith("## "))  return <h2 key={i} className="text-lg font-semibold mt-5 mb-2 text-primary">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
        if (line.trim() === "" || line.trim() === "---") return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm leading-relaxed text-foreground/90">{line}</p>;
      })}
    </div>
  );
}

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

// ── Botão de consolidação ─────────────────────────────────────────────────────

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
      className="flex items-center gap-2 rounded-lg border border-border bg-accent/30 hover:bg-accent px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <Icon className="h-4 w-4 text-primary" />
      )}
      <span className="flex-1 text-left">{isPending ? "Processando…" : label}</span>
      {jobId && (
        <span className="text-xs text-muted-foreground font-mono">#{jobId}</span>
      )}
    </button>
  );
}

// ── Viewer de consolidado ─────────────────────────────────────────────────────

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
        <MarkdownViewer content={data} />
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
  const [glossaryJobId, setGlossaryJobId]  = useState<string | undefined>();

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["interviews", niche],
    queryFn: () => getInterviews(niche),
    staleTime: 10_000,
  });

  const consolidateInsightsMutation = useMutation({
    mutationFn: () => consolidateInsights(niche),
    onSuccess: (data) => {
      setInsightsJobId(data.job_id);
      // Invalida após 10s para recarregar o conteúdo consolidado
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

  const total   = interviews.length;
  const withRaw = interviews.filter((iv) => iv.stages?.raw).length;
  const withStructured = interviews.filter((iv) => iv.stages?.structured).length;
  const withGlossary   = interviews.filter((iv) => iv.stages?.glossary).length;

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden">
      {/* Lista de entrevistas (esquerda) */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold truncate">{niche}</h2>
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
                  <Link
                    key={iv.name}
                    href={href}
                    className="flex flex-col gap-1.5 rounded-md px-3 py-2.5 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate group-hover:text-foreground text-foreground/80">
                        {iv.name}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/40 shrink-0" />
                    </div>
                    {iv.stages && (
                      <div className="flex flex-wrap gap-1 ml-5">
                        <StageDot ok={iv.stages.raw}        label="Bruta"      />
                        <StageDot ok={iv.stages.refined}    label="Refinada"   />
                        <StageDot ok={iv.stages.structured} label="Estrut."    />
                        <StageDot ok={iv.stages.glossary}   label="Glossário"  />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Painel de consolidação (direita) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Consolidados do Nicho</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Insights e glossário unificados de todas as entrevistas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {withRaw}/{total} transcritas
            </Badge>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-border shrink-0 flex gap-3">
          <div className="flex-1">
            <ConsolidateButton
              label="Consolidar Insights"
              icon={Sparkles}
              onClick={() => consolidateInsightsMutation.mutate()}
              isPending={consolidateInsightsMutation.isPending}
              jobId={insightsJobId}
            />
          </div>
          <div className="flex-1">
            <ConsolidateButton
              label="Consolidar Glossário"
              icon={BookOpen}
              onClick={() => consolidateGlossaryMutation.mutate()}
              isPending={consolidateGlossaryMutation.isPending}
              jobId={glossaryJobId}
            />
          </div>
        </div>

        <Tabs defaultValue="insights" className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pt-3 shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="insights" className="text-xs px-4">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="glossary" className="text-xs px-4">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                Glossário
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
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
