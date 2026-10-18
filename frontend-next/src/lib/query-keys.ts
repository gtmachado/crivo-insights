/**
 * Chaves do React Query em um só lugar. O mesmo recurso SEMPRE usa a mesma
 * chave — antes, `/status` tinha três chaves diferentes e cada uma disparava
 * sua própria requisição.
 */
export const qk = {
  niches:         ["niches"] as const,
  interviews:     (niche: string) => ["interviews", niche] as const,
  interviewMeta:  (niche: string, interview: string) => ["interview-meta", niche, interview] as const,
  interviewFiles: (niche: string, interview: string) => ["interview-files", niche, interview] as const,
  doc:            (niche: string, interview: string, doc: string) => ["doc", niche, interview, doc] as const,
  jobs:           ["jobs"] as const,
  nicheAnalysis:  (niche: string) => ["niche-analysis", niche] as const,
  analysisJob:    (niche: string, jobId: string) => ["analysis-job", niche, jobId] as const,
  systemStatus:   ["system-status"] as const,
  modelConfig:    ["model-config"] as const,
  prompts:        ["prompts-list"] as const,
  prompt:         (name: string) => ["prompt", name] as const,
};
