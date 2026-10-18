import { create } from "zustand";
import type { InterviewSubdir } from "./api";
import type { FileKind } from "./files";

/**
 * Identificador estável do arquivo atualmente aberto no viewer da entrevista.
 * Limpo ao trocar de entrevista.
 *
 * Provisório: a E6 move o documento ativo para a URL (?doc=) e remove este store.
 */
export type CurrentFile = {
  subdir: InterviewSubdir;
  name: string;
  kind: FileKind;
};

type AppStore = {
  currentFile: CurrentFile | null;
  setCurrentFile: (f: CurrentFile | null) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  currentFile: null,
  setCurrentFile: (f) => set({ currentFile: f }),
}));
