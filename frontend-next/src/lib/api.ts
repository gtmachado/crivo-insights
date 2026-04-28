import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SECRET   = process.env.NEXT_PUBLIC_API_SECRET || "";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${SECRET}`,
    // Bypass da pagina de aviso do ngrok free
    "ngrok-skip-browser-warning": "true",
  },
});

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
  `${BASE_URL}/media/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/${encodeURIComponent(filename)}`;
