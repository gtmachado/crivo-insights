export type VisualMode = "glow" | "simple";

export type VisualPreferences = {
  visualMode: VisualMode;
  backgroundMotion: boolean;
};

export const VISUAL_MODE_STORAGE_KEY = "crivo:visual-mode";
export const BACKGROUND_MOTION_STORAGE_KEY = "crivo:bg-motion";
export const LEGACY_SIMPLE_MODE_STORAGE_KEY = "crivo:simple-mode";
export const VISUAL_PREFERENCES_EVENT = "crivo:visual-preferences-change";

export const DEFAULT_VISUAL_PREFERENCES: VisualPreferences = {
  visualMode: "glow",
  backgroundMotion: true,
};

function hasBrowserStorage() {
  if (typeof window === "undefined") return false;

  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readVisualPreferences(): VisualPreferences {
  if (!hasBrowserStorage()) return DEFAULT_VISUAL_PREFERENCES;

  try {
    const storedMode = window.localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
    const legacySimple = window.localStorage.getItem(LEGACY_SIMPLE_MODE_STORAGE_KEY) === "1";
    const visualMode: VisualMode =
      storedMode === "simple" || legacySimple ? "simple" : "glow";

    const storedMotion = window.localStorage.getItem(BACKGROUND_MOTION_STORAGE_KEY);
    const backgroundMotion = storedMotion !== "0";

    return { visualMode, backgroundMotion };
  } catch {
    return DEFAULT_VISUAL_PREFERENCES;
  }
}

export function writeVisualPreferences(preferences: VisualPreferences) {
  if (!hasBrowserStorage()) return;

  try {
    window.localStorage.setItem(VISUAL_MODE_STORAGE_KEY, preferences.visualMode);
    if (preferences.visualMode === "simple") {
      window.localStorage.setItem(LEGACY_SIMPLE_MODE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(LEGACY_SIMPLE_MODE_STORAGE_KEY);
    }

    if (preferences.backgroundMotion) {
      window.localStorage.removeItem(BACKGROUND_MOTION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(BACKGROUND_MOTION_STORAGE_KEY, "0");
    }

    window.dispatchEvent(new Event(VISUAL_PREFERENCES_EVENT));
  } catch {
    // Preferências visuais são opcionais; falha de storage não deve quebrar o app.
  }
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
