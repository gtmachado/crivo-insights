"use client";

import { useEffect, useState } from "react";
import {
  readVisualPreferences,
  prefersReducedMotion,
  VISUAL_PREFERENCES_EVENT,
  type VisualPreferences,
} from "@/lib/visual-preferences";
import { cn } from "@/lib/utils";

/**
 * Fundo ambiente com 3 "blobs" gaussianos que flutuam lentamente.
 * - CSS keyframes definidos em globals.css
 * - z-index: 0 com pointer-events:none → não interfere em cliques
 * - Respeita prefers-reduced-motion e preferências locais
 *
 * Use UMA única instância no nível do (app) layout, atrás do conteúdo.
 */
export function AmbientBackground() {
  const [preferences, setPreferences] = useState<VisualPreferences | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    function syncPreferences() {
      setPreferences(readVisualPreferences());
      setReducedMotion(prefersReducedMotion());
    }

    syncPreferences();

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    mediaQuery.addEventListener("change", syncPreferences);
    window.addEventListener("storage", syncPreferences);
    window.addEventListener(VISUAL_PREFERENCES_EVENT, syncPreferences);

    return () => {
      mediaQuery.removeEventListener("change", syncPreferences);
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener(VISUAL_PREFERENCES_EVENT, syncPreferences);
    };
  }, []);

  if (!preferences || preferences.visualMode === "simple" || reducedMotion) {
    return null;
  }

  const motionEnabled = preferences.backgroundMotion;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Blob 1 — primary, topo-esquerdo */}
      <div
        className={cn(
          "ambient-blob ambient-blob-a",
          motionEnabled && "ambient-blob-motion-a",
        )}
        style={{ top: "-22%", left: "-14%", width: "64vw", height: "64vw" }}
      />
      {/* Blob 2 — accent (roxo), inferior-direito */}
      <div
        className={cn(
          "ambient-blob ambient-blob-b",
          motionEnabled && "ambient-blob-motion-b",
        )}
        style={{ right: "-18%", bottom: "-24%", width: "62vw", height: "62vw" }}
      />
      {/* Blob 3 — azul claro, eixo central deslocado */}
      <div
        className={cn(
          "ambient-blob ambient-blob-c",
          motionEnabled && "ambient-blob-motion-c",
        )}
        style={{ top: "26%", left: "34%", width: "42vw", height: "42vw" }}
      />

      {/* Camada de "vinheta" sutil pra não saturar nas bordas */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, var(--background) 100%)",
        }}
      />
    </div>
  );
}
