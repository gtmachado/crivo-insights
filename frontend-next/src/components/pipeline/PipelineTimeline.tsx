"use client";

import { Fragment, useState } from "react";
import { Check, Loader2, Clock, X } from "lucide-react";
import {
  type Stage,
  type StageId,
  type StageStatus,
  formatElapsed,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { PipelineStageDetails } from "./PipelineStageDetails";

type Orientation = "horizontal" | "vertical";

/**
 * Timeline visual do pipeline. Cada stage é um nó clicável que expande
 * detalhes (logs, tempo, modelo) em accordion.
 *
 * Modos:
 *   - horizontal: ideal pro topo da página da entrevista
 *   - vertical:   ideal pra cards do dashboard com várias entrevistas
 *
 * Props:
 *   - stages: Stage[] (use stagesFromInterview() ou job.stages)
 *   - orientation
 *   - expandable: se true, click no nó expande PipelineStageDetails inline
 *   - showLabels: se false, mostra só os nós (útil em formato muito compacto)
 *   - showDurations: mostra tempo embaixo do label em modo horizontal
 */
export function PipelineTimeline({
  stages,
  orientation = "horizontal",
  expandable = true,
  showLabels = true,
  showDurations = true,
}: {
  stages: Stage[];
  orientation?: Orientation;
  expandable?: boolean;
  showLabels?: boolean;
  showDurations?: boolean;
}) {
  const [openId, setOpenId] = useState<StageId | null>(null);

  function toggle(id: StageId) {
    if (!expandable) return;
    setOpenId((cur) => (cur === id ? null : id));
  }

  const openStage = openId ? stages.find((s) => s.id === openId) : null;

  // ── Vertical (dashboard) ──────────────────────────────────────────────────
  if (orientation === "vertical") {
    return (
      <div className="space-y-1">
        {stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          const isOpen = openId === s.id;
          const elapsed = formatElapsed(s.started_at, s.ended_at);
          return (
            <div key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                disabled={!expandable}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                  expandable && "hover:bg-accent",
                  isOpen && "bg-accent/60",
                )}
              >
                <div className="relative flex flex-col items-center shrink-0">
                  <StageDot stage={s} size="sm" />
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute top-5 w-px h-3",
                        connectorColor(s.status),
                      )}
                    />
                  )}
                </div>
                <span className="text-xs flex-1 truncate">{s.label}</span>
                {elapsed && (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {elapsed}
                  </span>
                )}
                <StatusBadge status={s.status} />
              </button>

              {expandable && isOpen && openStage && (
                <div className="ml-7 mr-1">
                  <PipelineStageDetails
                    stage={openStage}
                    onClose={() => setOpenId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Horizontal (topo da entrevista) ───────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex items-start">
        {stages.map((s, i) => {
          const elapsed = formatElapsed(s.started_at, s.ended_at);
          return (
            <Fragment key={s.id}>
              <div className="flex flex-col items-center min-w-0">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  disabled={!expandable}
                  title={`${s.label}${elapsed ? ` · ${elapsed}` : ""}`}
                  className={cn(
                    "group rounded-full transition-all",
                    expandable && "cursor-pointer",
                    openId === s.id && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                  )}
                >
                  <StageDot stage={s} size="md" />
                </button>
                {showLabels && (
                  <span
                    className={cn(
                      "mt-1.5 text-[10px] font-medium truncate max-w-[80px] text-center transition-colors",
                      s.status === "processing" && "text-primary",
                      s.status === "done"       && "text-foreground",
                      s.status === "error"      && "text-destructive",
                      s.status === "pending"    && "text-muted-foreground/60",
                    )}
                  >
                    {s.label}
                  </span>
                )}
                {showDurations && elapsed && (
                  <span className="text-[9px] font-mono text-muted-foreground/60">
                    {elapsed}
                  </span>
                )}
              </div>

              {i < stages.length - 1 && (
                <div className="flex-1 pt-3 px-1 min-w-[12px]">
                  <div
                    className={cn(
                      "h-0.5 w-full rounded-full",
                      connectorColor(s.status),
                    )}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {expandable && openStage && (
        <PipelineStageDetails
          stage={openStage}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function StageDot({
  stage,
  size = "md",
}: {
  stage: Stage;
  size?: "sm" | "md";
}) {
  const Icon =
    stage.status === "done"       ? Check :
    stage.status === "processing" ? Loader2 :
    stage.status === "error"      ? X :
                                    Clock;

  const wrapper = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  const icon    = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border-2 transition-all",
        wrapper,
        stage.status === "done"       && "bg-emerald-500/15 border-emerald-500 text-emerald-500",
        stage.status === "processing" && "bg-primary/15 border-primary text-primary glow-soft",
        stage.status === "pending"    && "bg-muted border-muted-foreground/25 text-muted-foreground/40",
        stage.status === "error"      && "bg-destructive/15 border-destructive text-destructive",
      )}
    >
      <Icon
        className={cn(icon, stage.status === "processing" && "animate-spin")}
      />
    </span>
  );
}

function StatusBadge({ status }: { status: StageStatus }) {
  if (status === "pending") return null;
  const cfg = {
    done:       { label: "ok",  cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    processing: { label: "...", cls: "bg-primary/15 text-primary border-primary/30 animate-pulse" },
    error:      { label: "erro", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  }[status];
  return (
    <span
      className={cn(
        "shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

function connectorColor(status: StageStatus): string {
  return (
    {
      done:       "bg-emerald-500",
      processing: "bg-gradient-to-r from-emerald-500 to-primary animate-pulse",
      error:      "bg-destructive",
      pending:    "bg-muted-foreground/15",
    }[status] ?? "bg-muted-foreground/15"
  );
}
