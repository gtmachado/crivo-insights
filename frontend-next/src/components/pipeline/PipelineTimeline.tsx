"use client";

import { Fragment, useState } from "react";
import { Check, Circle, Loader2, X } from "lucide-react";
import { type Stage, type StageId, type StageStatus, formatElapsed } from "@/lib/pipeline";
import { STAGE_STATUS, TONE, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { PipelineStageDetails } from "./PipelineStageDetails";

type Orientation = "horizontal" | "vertical";

const NODE: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground/60",
  info:    "border-info bg-info-soft text-info-foreground",
  success: "border-success bg-success-soft text-success-foreground",
  warning: "border-warning bg-warning-soft text-warning-foreground",
  danger:  "border-destructive bg-destructive-soft text-destructive-foreground",
};

const ICON: Record<StageStatus, React.ElementType> = {
  pending: Circle,
  processing: Loader2,
  done: Check,
  error: X,
};

function StageDot({ stage, size = "md" }: { stage: Stage; size?: "sm" | "md" }) {
  const Icon = ICON[stage.status];
  const tone = STAGE_STATUS[stage.status].tone;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2",
        size === "sm" ? "size-5" : "size-7",
        NODE[tone],
      )}
    >
      <Icon
        aria-hidden
        className={cn(size === "sm" ? "size-2.5" : "size-3.5", stage.status === "processing" && "animate-spin")}
      />
    </span>
  );
}

/** Cor do trecho entre duas etapas: acompanha o status da etapa anterior. */
function connector(status: StageStatus): string {
  return status === "done"
    ? "bg-success"
    : status === "processing"
      ? "bg-info"
      : status === "error"
        ? "bg-destructive"
        : "bg-border";
}

/**
 * Linha do tempo do pipeline. Cada etapa é clicável e expande os detalhes
 * (logs, tempo, modelo).
 *
 *  - horizontal: topo de páginas largas
 *  - vertical:   cards compactos (dashboard, painel lateral da entrevista)
 */
export function PipelineTimeline({
  stages,
  orientation = "horizontal",
  expandable = true,
}: {
  stages: Stage[];
  orientation?: Orientation;
  expandable?: boolean;
}) {
  const [openId, setOpenId] = useState<StageId | null>(null);
  const openStage = openId ? stages.find((s) => s.id === openId) : null;
  const toggle = (id: StageId) => expandable && setOpenId((cur) => (cur === id ? null : id));

  if (orientation === "vertical") {
    return (
      <ol className="space-y-0.5">
        {stages.map((s, i) => {
          const elapsed = formatElapsed(s.started_at, s.ended_at);
          const isOpen = openId === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                disabled={!expandable}
                aria-expanded={expandable ? isOpen : undefined}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  expandable && "hover:bg-muted",
                  isOpen && "bg-muted",
                )}
              >
                <StageDot stage={s} size="sm" />
                {i < stages.length - 1 && (
                  <span aria-hidden className={cn("absolute left-[1.15rem] top-[1.75rem] h-2 w-px", connector(s.status))} />
                )}
                <span className={cn("flex-1 truncate text-xs", s.status === "pending" && "text-muted-foreground")}>
                  {s.label}
                </span>
                {elapsed && <span className="shrink-0 font-mono text-2xs text-muted-foreground">{elapsed}</span>}
                {s.status !== "pending" && (
                  <span className={cn("shrink-0 text-2xs font-medium", TONE[STAGE_STATUS[s.status].tone].text)}>
                    {STAGE_STATUS[s.status].label}
                  </span>
                )}
              </button>
              {expandable && isOpen && openStage && (
                <div className="ml-7 mr-1">
                  <PipelineStageDetails stage={openStage} onClose={() => setOpenId(null)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="space-y-2">
      <ol className="flex items-start">
        {stages.map((s, i) => {
          const elapsed = formatElapsed(s.started_at, s.ended_at);
          return (
            <Fragment key={s.id}>
              <li className="flex min-w-0 flex-col items-center">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  disabled={!expandable}
                  aria-expanded={expandable ? openId === s.id : undefined}
                  title={`${s.label}${elapsed ? ` · ${elapsed}` : ""}`}
                  className={cn(
                    "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    openId === s.id && "ring-2 ring-ring/40 ring-offset-2 ring-offset-background",
                  )}
                >
                  <StageDot stage={s} />
                </button>
                <span
                  className={cn(
                    "mt-1.5 max-w-20 truncate text-center text-2xs font-medium",
                    s.status === "pending" ? "text-muted-foreground" : TONE[STAGE_STATUS[s.status].tone].text,
                  )}
                >
                  {s.label}
                </span>
                {elapsed && <span className="font-mono text-2xs text-muted-foreground">{elapsed}</span>}
              </li>
              {i < stages.length - 1 && (
                <li aria-hidden className="min-w-3 flex-1 px-1 pt-3">
                  <div className={cn("h-0.5 w-full rounded-full", connector(s.status))} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      {expandable && openStage && (
        <PipelineStageDetails stage={openStage} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
