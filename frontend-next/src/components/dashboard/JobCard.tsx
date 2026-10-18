"use client";

import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import type { Job } from "@/lib/api";
import { aggregateStatus, currentStage, formatElapsed, slugify } from "@/lib/pipeline";
import { STAGE_STATUS, TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PipelineTimeline } from "@/components/pipeline/PipelineTimeline";

/** Card de um job: entrevista, andamento atual e linha do tempo expansível. */
export function JobCard({ job }: { job: Job }) {
  const current = currentStage(job.stages);
  const status = aggregateStatus(job.stages);
  const meta = STAGE_STATUS[status];
  const elapsed = formatElapsed(job.started_at, job.ended_at);

  // O backend grava o nome original; a rota usa o slug.
  const href = `/nicho/${encodeURIComponent(slugify(job.niche))}/${encodeURIComponent(slugify(job.interview))}`;

  return (
    <article
      className={cn(
        "space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
        job.status === "running" && "ring-info/40",
        job.status === "error" && "ring-destructive/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={href}
            className="group inline-flex max-w-full items-center gap-1 rounded text-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{job.interview || "—"}</span>
            <ChevronRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {job.niche || "—"} · job <code className="font-mono">{job.job_id}</code>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {elapsed && <span className="font-mono text-2xs tabular-nums text-muted-foreground">{elapsed}</span>}
          <StatusBadge tone={meta.tone} label={meta.label} />
        </div>
      </div>

      {job.status === "running" && current && (
        <p className={cn("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs", TONE.info.soft)}>
          <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
          <span className="truncate">
            <span className="font-medium">{current.label}</span>
            {current.model && <span className="ml-2 font-mono text-2xs opacity-80">{current.model}</span>}
          </span>
        </p>
      )}

      {job.status === "error" && (
        <p className={cn("rounded-md px-2.5 py-1.5 font-mono text-xs", TONE.danger.soft)}>
          {job.log[job.log.length - 1] ?? "Erro desconhecido"}
        </p>
      )}

      <PipelineTimeline stages={job.stages} orientation="vertical" />
    </article>
  );
}
