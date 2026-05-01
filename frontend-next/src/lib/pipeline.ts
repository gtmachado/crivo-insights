/**
 * Modelagem das stages do pipeline (lado client) e helpers para derivar o
 * estado da timeline a partir de duas fontes:
 *
 *  1) Job ativo  → backend retorna `stages: Stage[]` com tempos/modelo/logs.
 *  2) Entrevista já processada → backend retorna apenas booleans `stages`
 *     em /interviews/{niche} (raw/refined/structured/glossary). Aqui
 *     reconstruímos uma timeline "achatada" sem tempos/logs.
 *
 * Mantém em sync com `PIPELINE_STAGES` em backend/api/routes/interviews.py.
 */

export type StageStatus = "pending" | "processing" | "done" | "error";

export type StageId =
  | "upload"
  | "convert"
  | "transcribe"
  | "refine"
  | "structure"
  | "glossary";

export type Stage = {
  id: StageId;
  label: string;
  status: StageStatus;
  /** Epoch (segundos) — só presente quando há job ativo / histórico do backend */
  started_at?: number | null;
  ended_at?: number | null;
  logs?: string[];
  /** Modelo configurado (LLM) ou Whisper, se aplicável */
  model?: string | null;
  /** Mensagem de erro (se status === "error") */
  error?: string | null;
};

export const STAGE_ORDER: StageId[] = [
  "upload",
  "convert",
  "transcribe",
  "refine",
  "structure",
  "glossary",
];

export const STAGE_LABELS: Record<StageId, string> = {
  upload:     "Upload",
  convert:    "Conversão",
  transcribe: "Transcrição",
  refine:     "Refino",
  structure:  "Estruturação",
  glossary:   "Glossário",
};

/**
 * Tooltip / hint curto pra cada stage. Aparece no detalhe expandido.
 */
export const STAGE_HINTS: Record<StageId, string> = {
  upload:     "Preserva o arquivo original em raw/",
  convert:    "Converte para WAV 16kHz mono e divide em chunks",
  transcribe: "Whisper local transcreve cada chunk",
  refine:     "LLM corrige pontuação, parágrafos e ruídos",
  structure:  "LLM extrai insights, dores e estrutura a entrevista",
  glossary:   "LLM gera glossário local com termos da entrevista",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reconstrói uma timeline simplificada quando NÃO há job ativo (entrevista já
 * processada e descarregada da memória). Usa os booleans de
 * /interviews/{niche} pra inferir done vs pending. Sem tempos/logs.
 *
 * Convenção: se `raw` está done, todas as 3 primeiras stages (upload, convert,
 * transcribe) são done — o pipeline não pode ter pulado etapas anteriores.
 */
export function stagesFromInterview(stages: {
  raw: boolean;
  refined: boolean;
  structured: boolean;
  glossary: boolean;
}): Stage[] {
  return [
    { id: "upload",     label: STAGE_LABELS.upload,     status: stages.raw        ? "done" : "pending" },
    { id: "convert",    label: STAGE_LABELS.convert,    status: stages.raw        ? "done" : "pending" },
    { id: "transcribe", label: STAGE_LABELS.transcribe, status: stages.raw        ? "done" : "pending" },
    { id: "refine",     label: STAGE_LABELS.refine,     status: stages.refined    ? "done" : "pending" },
    { id: "structure",  label: STAGE_LABELS.structure,  status: stages.structured ? "done" : "pending" },
    { id: "glossary",   label: STAGE_LABELS.glossary,   status: stages.glossary   ? "done" : "pending" },
  ];
}

/**
 * Slugify igual ao do backend (filesystem.py::_slugify), pra correlacionar
 * jobs em memória (que guardam nome original) com o slug da URL.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");
}

// ── Tempo / formatação ───────────────────────────────────────────────────────

export function elapsedSeconds(start?: number | null, end?: number | null): number | null {
  if (!start) return null;
  const e = end ?? Date.now() / 1000;
  return Math.max(0, e - start);
}

export function formatElapsed(start?: number | null, end?: number | null): string | null {
  const sec = elapsedSeconds(start, end);
  if (sec === null) return null;
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m < 60) return `${m}m${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h${String(mm).padStart(2, "0")}m`;
}

/**
 * Status agregado da timeline inteira — usado em badges resumidos.
 */
export function aggregateStatus(stages: Stage[]): StageStatus {
  if (stages.some((s) => s.status === "error"))      return "error";
  if (stages.some((s) => s.status === "processing")) return "processing";
  if (stages.every((s) => s.status === "done"))      return "done";
  return "pending";
}

/**
 * Stage atualmente em processamento, se houver.
 */
export function currentStage(stages: Stage[]): Stage | null {
  return stages.find((s) => s.status === "processing") ?? null;
}
