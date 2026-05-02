import axios from "axios";

// ── Resolução da URL e do secret ──────────────────────────────────────────────
// Ordem: localStorage (configurado pelo usuário) → env var → fallback localhost
// Como o ngrok free gera URL nova a cada sessão, deixamos o usuário sobrescrever
// pela tela /settings sem precisar redeploy.

const ENV_BASE   = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ENV_SECRET = process.env.NEXT_PUBLIC_API_SECRET || "";

export const LS_KEY_URL    = "crivo:apiUrl";
export const LS_KEY_SECRET = "crivo:apiSecret";

function readLS(key: string): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(key) || ""; } catch { return ""; }
}

export function getApiUrl()    { return readLS(LS_KEY_URL)    || ENV_BASE;   }
export function getApiSecret() { return readLS(LS_KEY_SECRET) || ENV_SECRET; }

export function setApiConfig(url: string, secret: string) {
  if (typeof window === "undefined") return;
  if (url)    window.localStorage.setItem(LS_KEY_URL, url.trim());
  else        window.localStorage.removeItem(LS_KEY_URL);
  if (secret) window.localStorage.setItem(LS_KEY_SECRET, secret.trim());
  else        window.localStorage.removeItem(LS_KEY_SECRET);
  // Atualiza axios in-place para próximas requisições
  api.defaults.baseURL = getApiUrl();
  api.defaults.headers["Authorization"] = `Bearer ${getApiSecret()}`;
}

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    Authorization: `Bearer ${getApiSecret()}`,
    "ngrok-skip-browser-warning": "true",
  },
});

// Hidrata após mount no client (env serve como fallback no SSR)
if (typeof window !== "undefined") {
  api.defaults.baseURL = getApiUrl();
  api.defaults.headers["Authorization"] = `Bearer ${getApiSecret()}`;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Niche = string;

/**
 * Metadata de uma entrevista. Todos os campos são opcionais para manter
 * compatibilidade com entrevistas anteriores ao GSD-002 (sem metadata.json).
 *
 * FUTURO (BL-007 / Supabase Auth): quando autenticação for implementada,
 * interviewer_user_id será derivado do JWT pelo backend.
 * interviewer_name virá do perfil Supabase. O campo já existe aqui para
 * facilitar a migração sem breaking change.
 */
export type InterviewMeta = {
  title?: string;
  niche?: string;
  interview_slug?: string;
  interviewee_name?: string;
  interviewee_phone?: string;
  interviewee_email?: string;
  interviewer_name?: string;
  interviewer_user_id?: string; // reservado para Supabase user ID
  notes?: string;
  created_at?: string;
  source_filename?: string;
  updated_at?: string;
};

export type InterviewStages = {
  raw: boolean;
  refined: boolean;
  structured: boolean;
  glossary: boolean;
};

export type Interview = {
  name: string;
  stages: InterviewStages;
};

export type JobStatus = "running" | "done" | "error";

export type JobStage = {
  id: "upload" | "convert" | "transcribe" | "refine" | "structure" | "glossary";
  label: string;
  status: "pending" | "processing" | "done" | "error";
  started_at?: number | null;
  ended_at?: number | null;
  logs?: string[];
  model?: string | null;
  error?: string | null;
};

export type Job = {
  job_id: string;
  niche: string;
  interview: string;
  status: JobStatus;
  log: string[];
  paths: Record<string, string>;
  /** Lista de stages com tempos/modelo/logs por etapa. Pode estar ausente em
   * jobs antigos da memória (compat). */
  stages?: JobStage[];
  started_at?: number | null;
  ended_at?: number | null;
};

export type SystemStatus = {
  llm_provider: string;
  api_key_configured: boolean;
  whisper_model: string;
  data_dir: string;
  models: Record<string, string>;
};

// ── Nichos ────────────────────────────────────────────────────────────────────

export const getNiches = () =>
  api.get<Niche[]>("/niches/").then((r) => r.data);

// ── Entrevistas ───────────────────────────────────────────────────────────────

export const getInterviews = (niche: string) =>
  api.get<Interview[]>(`/interviews/${encodeURIComponent(niche)}`).then((r) => r.data);

/** Campos de metadata enviados junto com o upload. Todos opcionais. */
export type UploadMetadata = Pick<
  InterviewMeta,
  | "title"
  | "interviewee_name"
  | "interviewee_phone"
  | "interviewee_email"
  | "interviewer_name"
  | "notes"
>;

export const uploadInterview = (
  file: File,
  niche: string,
  interviewName: string,
  onProgress?: (pct: number) => void,
  metadata?: UploadMetadata,
) => {
  const form = new FormData();
  form.append("file", file);
  form.append("niche", niche);
  form.append("interview_name", interviewName);

  // Metadata — campos opcionais. Backend salva metadata.json antes do pipeline.
  if (metadata?.title)              form.append("meta_title",               metadata.title);
  if (metadata?.interviewee_name)   form.append("meta_interviewee_name",    metadata.interviewee_name);
  if (metadata?.interviewee_phone)  form.append("meta_interviewee_phone",   metadata.interviewee_phone);
  if (metadata?.interviewee_email)  form.append("meta_interviewee_email",   metadata.interviewee_email);
  if (metadata?.interviewer_name)   form.append("meta_interviewer_name",    metadata.interviewer_name);
  if (metadata?.notes)              form.append("meta_notes",               metadata.notes);

  return api.post<{ job_id: string; message: string }>("/interviews/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  }).then((r) => r.data);
};

export const getJobStatus = (jobId: string) =>
  api.get<Job>(`/interviews/status/${jobId}`).then((r) => r.data);

export const getAllJobs = () =>
  api.get<Job[]>("/pipeline/jobs").then((r) => r.data);

// ── Documentos ────────────────────────────────────────────────────────────────

export type DocType = "raw" | "refined" | "structured" | "glossary";
export type EditableDocType = Exclude<DocType, "glossary">;

export const getDocument = (niche: string, interview: string, doc: DocType) =>
  api
    .get<{ content: string }>(
      `/interviews/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/${doc}`,
    )
    .then((r) => r.data.content);

export const updateDocument = (
  niche: string,
  interview: string,
  doc: EditableDocType,
  content: string,
) =>
  api
    .put<{ ok: boolean; path: string; size: number }>(
      `/interviews/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/${doc}`,
      { content },
    )
    .then((r) => r.data);

// ── Arquivos da entrevista (FileExplorer) ─────────────────────────────────────

export type InterviewSubdir =
  | "raw"
  | "processed"
  | "parts"
  | "outputs"
  | "glossary";

export type FileEntry = {
  name: string;
  size: number;
  /** epoch (segundos) */
  modified: number;
};

export type InterviewFiles = Record<InterviewSubdir, FileEntry[]>;

export const getInterviewFiles = (niche: string, interview: string) =>
  api
    .get<InterviewFiles>(
      `/interviews/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/files`,
    )
    .then((r) => r.data);

// ── Exclusão de entrevista ────────────────────────────────────────────────────

export const deleteInterview = (niche: string, interview: string) =>
  api
    .delete<{ ok: boolean; deleted: boolean }>(
      `/interviews/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}`,
    )
    .then((r) => r.data);

// ── Metadata da entrevista (GSD-002) ─────────────────────────────────────────

export const getInterviewMeta = (niche: string, interview: string) =>
  api
    .get<InterviewMeta>(
      `/interviews/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/meta`,
    )
    .then((r) => r.data);

export const updateInterviewMeta = (
  niche: string,
  interview: string,
  meta: Partial<InterviewMeta>,
) =>
  api
    .put<{ ok: boolean }>(
      `/interviews/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/meta`,
      meta,
    )
    .then((r) => r.data);

// ── Consolidação ──────────────────────────────────────────────────────────────

export const consolidateInsights = (niche: string) =>
  api.post<{ job_id: string }>(`/niches/${encodeURIComponent(niche)}/consolidate/insights`).then((r) => r.data);

export const consolidateGlossary = (niche: string) =>
  api.post<{ job_id: string }>(`/niches/${encodeURIComponent(niche)}/consolidate/glossary`).then((r) => r.data);

export const getConsolidatedInsights = (niche: string) =>
  api.get<{ content: string }>(`/niches/${encodeURIComponent(niche)}/insights`).then((r) => r.data.content);

export const getConsolidatedGlossary = (niche: string) =>
  api.get<{ content: string }>(`/niches/${encodeURIComponent(niche)}/glossary`).then((r) => r.data.content);

// ── Análise manual de nicho (Fase 4) ──────────────────────────────────────────

export type NicheAnalysisJob = {
  status: "running" | "done" | "error";
  kind: "analysis";
  niche: string;
  interviews: string[];
  log: string[];
  path?: string;
};

export const analyzeNiche = (niche: string, interviews: string[]) =>
  api
    .post<{ job_id: string; message: string }>(
      `/niches/${encodeURIComponent(niche)}/analyze`,
      { interviews },
    )
    .then((r) => r.data);

export const getNicheAnalysisJob = (niche: string, jobId: string) =>
  api
    .get<NicheAnalysisJob>(
      `/niches/${encodeURIComponent(niche)}/analyze/status/${encodeURIComponent(jobId)}`,
    )
    .then((r) => r.data);

export const getNicheAnalysis = (niche: string) =>
  api
    .get<{ content: string }>(
      `/niches/${encodeURIComponent(niche)}/analysis`,
    )
    .then((r) => r.data.content);

// ── Sistema ───────────────────────────────────────────────────────────────────

export const getSystemStatus = () =>
  api.get<SystemStatus>("/status").then((r) => r.data);

// ── Configuração de modelos (GSD-004) ─────────────────────────────────────────

export type ModelConfig = {
  /** Overrides salvos em data/config/models.json */
  saved: Record<string, string>;
  /** Modelo efetivo em runtime por etapa (saved → .env → default do código) */
  effective: Record<string, string>;
  /** Lista de modelos permitidos no dropdown */
  allowed_models: string[];
  /** Etapas fixas, não configuráveis (ex: niche_analysis) */
  fixed: Record<string, string>;
};

export type ModelConfigUpdate = {
  refine?: string;
  structure?: string;
  glossary?: string;
  consolidate?: string;
  consolidate_glossary?: string;
};

export const getModelConfig = () =>
  api.get<ModelConfig>("/config/models").then((r) => r.data);

export const updateModelConfig = (data: ModelConfigUpdate) =>
  api.put<{ ok: boolean }>("/config/models", data).then((r) => r.data);

/**
 * URL para o endpoint /media. Inclui o token como query param porque tags
 * <audio>/<video>/<source> não enviam o header Authorization. O backend
 * aceita ambas as formas (header tem prioridade).
 *
 * Também adiciona `ngrok-skip-browser-warning=true` para evitar a página
 * intersticial do ngrok free.
 */
export const mediaUrl = (niche: string, interview: string, filename: string) => {
  const url = `${getApiUrl()}/media/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/${encodeURIComponent(filename)}`;
  const params = new URLSearchParams();
  const token = getApiSecret();
  if (token) params.set("token", token);
  params.set("ngrok-skip-browser-warning", "true");
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
};
