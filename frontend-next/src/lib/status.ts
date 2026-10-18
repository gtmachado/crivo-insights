import type { JobStatus } from "./api";
import type { StageStatus } from "./pipeline";

/**
 * Mapa único de status → rótulo + tom. Antes existiam cinco cópias (dashboard,
 * PipelineTimeline x3, PipelineStageDetails) com cores `emerald-*`/`green-*`/`amber-*`
 * fixas. Agora tudo passa por aqui e pelos tokens semânticos de `globals.css`.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Classes por tom: `soft` = fundo + texto legível (badge); `dot` = cor sólida (ponto, barra). */
export const TONE: Record<Tone, { soft: string; dot: string; text: string }> = {
  neutral: { soft: "bg-muted text-muted-foreground",                   dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  info:    { soft: "bg-info-soft text-info-foreground",                 dot: "bg-info",                text: "text-info-foreground" },
  success: { soft: "bg-success-soft text-success-foreground",           dot: "bg-success",             text: "text-success-foreground" },
  warning: { soft: "bg-warning-soft text-warning-foreground",           dot: "bg-warning",             text: "text-warning-foreground" },
  danger:  { soft: "bg-destructive-soft text-destructive-foreground",   dot: "bg-destructive",         text: "text-destructive-foreground" },
};

export type StatusMeta = { label: string; tone: Tone };

export const STAGE_STATUS: Record<StageStatus, StatusMeta> = {
  pending:    { label: "Pendente",    tone: "neutral" },
  processing: { label: "Processando", tone: "info" },
  done:       { label: "Concluída",   tone: "success" },
  error:      { label: "Erro",        tone: "danger" },
};

export const JOB_STATUS: Record<JobStatus, StatusMeta> = {
  running: { label: "Em andamento", tone: "info" },
  done:    { label: "Concluído",    tone: "success" },
  error:   { label: "Erro",         tone: "danger" },
};
