"use client";

import {
  Check,
  Clock,
  Loader2,
  X,
  AlertCircle,
  ChevronUp,
  Cpu,
  Timer,
  ScrollText,
} from "lucide-react";
import { type Stage, formatElapsed, STAGE_HINTS } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Stage["status"], string> = {
  pending:    "Pendente",
  processing: "Processando",
  done:       "Concluído",
  error:      "Erro",
};

/**
 * Detalhe expandido de uma stage. Aparece ABAIXO do StageNode quando o user
 * clica num stage da timeline. É a "sanfona" pedida no escopo:
 *
 *  - Status atual
 *  - Tempo de execução (se há started_at)
 *  - Modelo usado (se aplicável — Whisper ou LLM)
 *  - Logs textuais coletados durante a execução da stage
 *  - Mensagem de erro (se aplicável)
 */
export function PipelineStageDetails({
  stage,
  onClose,
}: {
  stage: Stage;
  onClose?: () => void;
}) {
  const Icon =
    stage.status === "done"       ? Check :
    stage.status === "processing" ? Loader2 :
    stage.status === "error"      ? X :
                                    Clock;

  const elapsed = formatElapsed(stage.started_at, stage.ended_at);
  const hint    = STAGE_HINTS[stage.id];

  return (
    <div className="mt-3 rounded-lg glass border border-border/40 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
              stage.status === "done"       && "bg-emerald-500/15 text-emerald-500",
              stage.status === "processing" && "bg-primary/15 text-primary",
              stage.status === "pending"    && "bg-muted text-muted-foreground/60",
              stage.status === "error"      && "bg-destructive/15 text-destructive",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                stage.status === "processing" && "animate-spin",
              )}
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{stage.label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Recolher detalhes"
            className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 text-xs border-t border-border/40 pt-3">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Status
          </p>
          <p
            className={cn(
              "font-medium",
              stage.status === "done"       && "text-emerald-500",
              stage.status === "processing" && "text-primary",
              stage.status === "error"      && "text-destructive",
              stage.status === "pending"    && "text-muted-foreground",
            )}
          >
            {STATUS_LABEL[stage.status]}
          </p>
        </div>

        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
            <Timer className="h-2.5 w-2.5" /> Tempo
          </p>
          <p className="font-mono">{elapsed ?? "—"}</p>
        </div>

        <div className="space-y-0.5 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
            <Cpu className="h-2.5 w-2.5" /> Modelo
          </p>
          <p
            className="font-mono text-[10px] truncate"
            title={stage.model ?? undefined}
          >
            {stage.model ?? "—"}
          </p>
        </div>
      </div>

      {/* Logs */}
      {stage.logs && stage.logs.length > 0 && (
        <div className="border-t border-border/40 pt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
            <ScrollText className="h-2.5 w-2.5" /> Logs ({stage.logs.length})
          </p>
          <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-muted-foreground bg-background/60 p-2.5 rounded max-h-48 overflow-y-auto border border-border/40">
            {stage.logs.join("\n")}
          </pre>
        </div>
      )}

      {/* Erro */}
      {stage.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5 flex gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-destructive">Falha na execução</p>
            <p className="text-[11px] text-destructive/90 font-mono mt-0.5 break-words">
              {stage.error}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
