"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getAllJobs, getSystemStatus, type Job } from "@/lib/api";
import {
  type Stage,
  STAGE_ORDER,
  STAGE_LABELS,
  aggregateStatus,
  currentStage,
  formatElapsed,
  slugify,
} from "@/lib/pipeline";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PipelineTimeline } from "@/components/pipeline/PipelineTimeline";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  Database,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dashboard com:
 *  - Cards de resumo (running / done / errors)
 *  - Lista de jobs com timeline vertical compacta por entrevista
 *  - Polling adaptativo: 3s quando há job rodando, 30s quando tudo idle
 *
 * Suporta múltiplas entrevistas processando em paralelo (já era o caso —
 * agora visualiza melhor com timeline e barra de progresso individual).
 */

export default function DashboardPage() {
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: getAllJobs,
    refetchInterval: (q) => {
      const data = q.state.data;
      return data && data.some((j) => j.status === "running") ? 3000 : 30_000;
    },
  });

  const { data: sysStatus } = useQuery({
    queryKey: ["system-status"],
    queryFn: getSystemStatus,
    staleTime: 60_000,
  });

  const jobs = jobsQuery.data ?? [];

  // Ordenar: running primeiro, depois por started_at desc.
  const sortedJobs = [...jobs].sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return  1;
    return (b.started_at ?? 0) - (a.started_at ?? 0);
  });

  const running = jobs.filter((j) => j.status === "running").length;
  const done    = jobs.filter((j) => j.status === "done").length;
  const errors  = jobs.filter((j) => j.status === "error").length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Status do pipeline em tempo real — atualiza a cada 3s quando há jobs ativos.
        </p>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processando</p>
                <p className="text-3xl font-bold text-primary tabular-nums">{running}</p>
              </div>
              <Loader2
                className={cn(
                  "h-8 w-8 text-primary",
                  running > 0 && "animate-spin",
                )}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-3xl font-bold text-emerald-500 tabular-nums">{done}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com erros</p>
                <p className="text-3xl font-bold text-destructive tabular-nums">{errors}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sistema */}
      {sysStatus && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> Sistema
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <SysItem label="Provider"  value={sysStatus.llm_provider} />
              <SysItem label="Whisper"   value={sysStatus.whisper_model} />
              <SysItem
                label="Refine"
                value={sysStatus.models?.refine ?? "—"}
                mono
              />
              <SysItem
                label="Structure"
                value={sysStatus.models?.structure ?? "—"}
                mono
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de jobs */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5 px-1">
          <Database className="h-3.5 w-3.5" /> Jobs em memória ({jobs.length})
        </p>

        {jobsQuery.isLoading ? (
          <Card>
            <CardContent className="pt-6 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : sortedJobs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 flex flex-col items-center gap-2 py-8">
              <Sparkles className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhum job na memória. Faça upload de uma entrevista para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedJobs.map((job) => <JobCard key={job.job_id} job={job} />)
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function SysItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p
        className={cn(
          "text-sm truncate",
          mono && "font-mono text-xs",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const stages: Stage[] = (job.stages as Stage[] | undefined) ?? [];
  const cur     = currentStage(stages);
  const agg     = stages.length ? aggregateStatus(stages) : (job.status as Stage["status"]);
  const elapsed = formatElapsed(job.started_at, job.ended_at);

  // Link pra entrevista (slug pra slug — backend grava nome original em job.*).
  const nicheSlug   = slugify(job.niche);
  const interviewSlug = slugify(job.interview);
  const href = `/nicho/${encodeURIComponent(nicheSlug)}/${encodeURIComponent(interviewSlug)}`;

  return (
    <Card className={cn(
      "transition-all",
      job.status === "running" && "ring-2 ring-primary/20 glow-soft",
      job.status === "error"   && "ring-1 ring-destructive/30",
    )}>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={href}
              className="text-sm font-semibold hover:text-primary transition-colors truncate inline-flex items-center gap-1 group"
            >
              {job.interview || "—"}
              <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <p className="text-xs text-muted-foreground truncate">
              {job.niche || "—"} · job <code className="font-mono">{job.job_id}</code>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {elapsed && (
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                {elapsed}
              </span>
            )}
            <StatusBadge status={agg} />
          </div>
        </div>

        {/* Linha "atualmente fazendo X" */}
        {job.status === "running" && cur && (
          <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded-md px-2.5 py-1.5 flex items-center gap-2">
            <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
            <span className="truncate">
              <span className="text-primary font-medium">{cur.label}</span>
              {cur.model && (
                <span className="ml-2 font-mono text-[10px] opacity-70">
                  {cur.model}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Erro */}
        {job.status === "error" && (
          <div className="text-xs bg-destructive/10 border border-destructive/30 rounded-md px-2.5 py-1.5 text-destructive">
            <span className="font-mono">
              {job.log?.[job.log.length - 1] ?? "Erro desconhecido"}
            </span>
          </div>
        )}

        {/* Timeline */}
        {stages.length > 0 ? (
          <PipelineTimeline
            stages={stages}
            orientation="vertical"
            expandable
          />
        ) : (
          // Job antigo (sem stages estruturados) — fallback simples
          <div className="flex flex-wrap gap-1.5">
            {STAGE_ORDER.map((sid) => (
              <Badge key={sid} variant="outline" className="text-xs">
                {STAGE_LABELS[sid]}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Stage["status"] | "running" }) {
  // job.status "running" → mapeia pra "processing" pro visual
  const s = status === "running" ? "processing" : status;
  const cfg = {
    done:       { label: "Concluído",   cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    processing: { label: "Processando", cls: "bg-primary/15 text-primary border-primary/30 animate-pulse" },
    error:      { label: "Erro",        cls: "bg-destructive/15 text-destructive border-destructive/30" },
    pending:    { label: "Pendente",    cls: "bg-muted text-muted-foreground border-border" },
  }[s];
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}
