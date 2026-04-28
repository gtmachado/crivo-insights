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

export type Job = {
  job_id: string;
  niche: string;
  interview: string;
  status: JobStatus;
  log: string[];
  paths: Record<string, string>;
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

export const uploadInterview = (
  file: File,
  niche: string,
  interviewName: string,
  onProgress?: (pct: number) => void,
) => {
  const form = new FormData();
  form.append("file", file);
  form.append("niche", niche);
  form.append("interview_name", interviewName);

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

export const getDocument = (niche: string, interview: string, doc: DocType) =>
  api
    .get<{ content: string }>(
      `/interviews/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/${doc}`,
    )
    .then((r) => r.data.content);

// ── Consolidação ──────────────────────────────────────────────────────────────

export const consolidateInsights = (niche: string) =>
  api.post<{ job_id: string }>(`/niches/${encodeURIComponent(niche)}/consolidate/insights`).then((r) => r.data);

export const consolidateGlossary = (niche: string) =>
  api.post<{ job_id: string }>(`/niches/${encodeURIComponent(niche)}/consolidate/glossary`).then((r) => r.data);

export const getConsolidatedInsights = (niche: string) =>
  api.get<{ content: string }>(`/niches/${encodeURIComponent(niche)}/insights`).then((r) => r.data.content);

export const getConsolidatedGlossary = (niche: string) =>
  api.get<{ content: string }>(`/niches/${encodeURIComponent(niche)}/glossary`).then((r) => r.data.content);

// ── Sistema ───────────────────────────────────────────────────────────────────

export const getSystemStatus = () =>
  api.get<SystemStatus>("/status").then((r) => r.data);

export const mediaUrl = (niche: string, interview: string, filename: string) =>
  `${getApiUrl()}/media/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/${encodeURIComponent(filename)}`;
