import axios, { isAxiosError } from "axios";
import type { Stage } from "./pipeline";

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
  applyConfig();
}

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: { "ngrok-skip-browser-warning": "true" },
});

/** Atualiza baseURL e Authorization no axios (lê localStorage → env). */
function applyConfig() {
  api.defaults.baseURL = getApiUrl();
  const secret = getApiSecret();
  if (secret) api.defaults.headers["Authorization"] = `Bearer ${secret}`;
  else delete api.defaults.headers["Authorization"];
}

// Hidrata após mount no client (env serve como fallback no SSR).
applyConfig();

// ── Erros ─────────────────────────────────────────────────────────────────────

/** Erro normalizado: `message` já é o `detail` do FastAPI (ou algo legível). */
export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string };

function messageFromError(err: unknown): { message: string; status?: number } {
  if (!isAxiosError(err)) {
    return { message: err instanceof Error ? err.message : "Erro desconhecido." };
  }
  const status = err.response?.status;
  if (!err.response) {
    return { message: "Não foi possível conectar ao servidor. Verifique a URL em Configurações." };
  }
  const detail = (err.response.data as { detail?: string | ValidationItem[] } | undefined)?.detail;
  if (typeof detail === "string") return { message: detail, status };
  if (Array.isArray(detail) && detail.length) {
    return { message: detail.map((d) => d.msg ?? "valor inválido").join("; "), status };
  }
  if (status === 401) return { message: "Token de acesso inválido. Confira o secret em Configurações.", status };
  return { message: err.message, status };
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const { message, status } = messageFromError(err);
    return Promise.reject(new ApiError(message, status));
  },
);

/** Mensagem pronta para toast, aceitando qualquer valor capturado em um catch. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Erro desconhecido.";
}

// ── Helpers de rota ───────────────────────────────────────────────────────────

const seg = encodeURIComponent;
const nichePath = (niche: string) => `/niches/${seg(niche)}`;
const interviewPath = (niche: string, interview: string) =>
  `/interviews/${seg(niche)}/${seg(interview)}`;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Niche = string;

/**
 * Metadata de uma entrevista. Todos os campos são opcionais para manter
 * compatibilidade com entrevistas anteriores ao GSD-002 (sem metadata.json).
 *
 * FUTURO (BL-007 / Supabase Auth): interviewer_user_id será derivado do JWT
 * pelo backend e interviewer_name virá do perfil Supabase.
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

/** Quais documentos já existem (gerados pelo pipeline). */
export type InterviewStages = {
  raw: boolean;
  refined: boolean;
  structured: boolean;
  glossary: boolean;
};

export type DocType = keyof InterviewStages;

export type Interview = {
  name: string;
  stages: InterviewStages;
};

export type JobStatus = "running" | "done" | "error";

export type Job = {
  job_id: string;
  niche: string;
  interview: string;
  status: JobStatus;
  log: string[];
  paths: Record<string, string>;
  /** Etapas com tempos/modelo/logs, sempre presentes no backend atual. */
  stages: Stage[];
  started_at: number;
  ended_at: number | null;
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
  api.get<Interview[]>(`/interviews/${seg(niche)}`).then((r) => r.data);

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

/** Campo do form multipart de cada metadata (o backend salva metadata.json antes do pipeline). */
const UPLOAD_META_FIELDS: Record<keyof UploadMetadata, string> = {
  title:             "meta_title",
  interviewee_name:  "meta_interviewee_name",
  interviewee_phone: "meta_interviewee_phone",
  interviewee_email: "meta_interviewee_email",
  interviewer_name:  "meta_interviewer_name",
  notes:             "meta_notes",
};

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

  for (const key of Object.keys(UPLOAD_META_FIELDS) as (keyof UploadMetadata)[]) {
    const value = metadata?.[key];
    if (value) form.append(UPLOAD_META_FIELDS[key], value);
  }

  return api
    .post<{ job_id: string; message: string }>("/interviews/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    })
    .then((r) => r.data);
};

export const getAllJobs = () =>
  api.get<Job[]>("/pipeline/jobs").then((r) => r.data);

// ── Documentos ────────────────────────────────────────────────────────────────

export const getDocument = (niche: string, interview: string, doc: DocType) =>
  api
    .get<{ content: string }>(`${interviewPath(niche, interview)}/${doc}`)
    .then((r) => r.data.content);

export const updateDocument = (
  niche: string,
  interview: string,
  doc: DocType,
  content: string,
) =>
  api
    .put<{ ok: boolean; path: string; size: number }>(
      `${interviewPath(niche, interview)}/${doc}`,
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
    .get<InterviewFiles>(`${interviewPath(niche, interview)}/files`)
    .then((r) => r.data);

// ── Exclusão de entrevista ────────────────────────────────────────────────────

export const deleteInterview = (niche: string, interview: string) =>
  api
    .delete<{ ok: boolean; deleted: boolean }>(interviewPath(niche, interview))
    .then((r) => r.data);

// ── Metadata da entrevista (GSD-002) ─────────────────────────────────────────

export const getInterviewMeta = (niche: string, interview: string) =>
  api
    .get<InterviewMeta>(`${interviewPath(niche, interview)}/meta`)
    .then((r) => r.data);

export const updateInterviewMeta = (
  niche: string,
  interview: string,
  meta: Partial<InterviewMeta>,
) =>
  api
    .put<{ ok: boolean }>(`${interviewPath(niche, interview)}/meta`, meta)
    .then((r) => r.data);

// ── Análise de nicho ──────────────────────────────────────────────────────────

export type NicheAnalysisJob = {
  status: JobStatus;
  kind: "analysis";
  niche: string;
  interviews: string[];
  log: string[];
  path?: string;
};

export const analyzeNiche = (niche: string, interviews: string[]) =>
  api
    .post<{ job_id: string; message: string }>(`${nichePath(niche)}/analyze`, { interviews })
    .then((r) => r.data);

export const getNicheAnalysisJob = (niche: string, jobId: string) =>
  api
    .get<NicheAnalysisJob>(`${nichePath(niche)}/analyze/status/${seg(jobId)}`)
    .then((r) => r.data);

export const getNicheAnalysis = (niche: string) =>
  api
    .get<{ content: string }>(`${nichePath(niche)}/analysis`)
    .then((r) => r.data.content);

// ── Sistema ───────────────────────────────────────────────────────────────────

export const getSystemStatus = () =>
  api.get<SystemStatus>("/status").then((r) => r.data);

// ── Configuração de modelos (GSD-004) ─────────────────────────────────────────

export type ModelConfig = {
  /** Overrides salvos em data/config/models.json */
  saved: Record<string, string>;
  /** Modelo efetivo em runtime por etapa (saved → .env → default do provider) */
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
};

export const getModelConfig = () =>
  api.get<ModelConfig>("/config/models").then((r) => r.data);

export const updateModelConfig = (data: ModelConfigUpdate) =>
  api.put<{ ok: boolean }>("/config/models", data).then((r) => r.data);

// ── Configuração de prompts (GSD-005) ─────────────────────────────────────────

export type PromptInfo = {
  name: string;
  label: string;
  filename: string;
  has_default: boolean;
};

export type PromptContent = {
  name: string;
  content: string;
  has_default: boolean;
};

export const getPrompts = () =>
  api.get<PromptInfo[]>("/config/prompts").then((r) => r.data);

export const getPrompt = (name: string) =>
  api.get<PromptContent>(`/config/prompts/${seg(name)}`).then((r) => r.data);

export const updatePrompt = (name: string, content: string) =>
  api.put<{ ok: boolean }>(`/config/prompts/${seg(name)}`, { content }).then((r) => r.data);

export const restorePrompt = (name: string) =>
  api
    .post<{ ok: boolean; restored: boolean }>(`/config/prompts/${seg(name)}/restore`)
    .then((r) => r.data);

/**
 * URL para o endpoint /media. Inclui o token como query param porque tags
 * <audio>/<video>/<source> não enviam o header Authorization. O backend
 * aceita ambas as formas (header tem prioridade).
 *
 * Também adiciona `ngrok-skip-browser-warning=true` para evitar a página
 * intersticial do ngrok free.
 */
export const mediaUrl = (niche: string, interview: string, filename: string) => {
  const url = `${getApiUrl()}/media/${seg(niche)}/${seg(interview)}/${seg(filename)}`;
  const params = new URLSearchParams();
  const token = getApiSecret();
  if (token) params.set("token", token);
  params.set("ngrok-skip-browser-warning", "true");
  return `${url}?${params.toString()}`;
};
