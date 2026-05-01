import { create } from "zustand";
import type { Job, InterviewSubdir } from "./api";
import type { FileKind } from "./files";

/**
 * Identificador estável do arquivo atualmente aberto no viewer da entrevista.
 * Limpo ao trocar de entrevista.
 */
export type CurrentFile = {
  subdir: InterviewSubdir;
  name: string;
  kind: FileKind;
};

type AppStore = {
  // jobs ativos (polling)
  jobs: Record<string, Job>;
  setJob: (id: string, job: Job) => void;
  removeJob: (id: string) => void;

  // navegação do explorer (legado — mantido por compat)
  selectedNiche: string | null;
  selectedInterview: string | null;
  setSelected: (niche: string | null, interview?: string | null) => void;

  // arquivo atualmente aberto no viewer da página de entrevista
  currentFile: CurrentFile | null;
  setCurrentFile: (f: CurrentFile | null) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  jobs: {},
  setJob: (id, job) => set((s) => ({ jobs: { ...s.jobs, [id]: job } })),
  removeJob: (id) =>
    set((s) => {
      const jobs = { ...s.jobs };
      delete jobs[id];
      return { jobs };
    }),

  selectedNiche: null,
  selectedInterview: null,
  setSelected: (niche, interview = null) =>
    set({ selectedNiche: niche, selectedInterview: interview }),

  currentFile: null,
  setCurrentFile: (f) => set({ currentFile: f }),
}));
