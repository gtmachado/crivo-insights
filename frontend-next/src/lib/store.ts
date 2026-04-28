import { create } from "zustand";
import type { Job } from "./api";

type AppStore = {
  // jobs ativos (polling)
  jobs: Record<string, Job>;
  setJob: (id: string, job: Job) => void;
  removeJob: (id: string) => void;

  // navegação do explorer
  selectedNiche: string | null;
  selectedInterview: string | null;
  setSelected: (niche: string | null, interview?: string | null) => void;
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
}));
