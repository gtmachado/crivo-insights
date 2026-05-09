"use client";

import { useEffect, useState } from "react";
import { Activity, EyeOff, Sparkles } from "lucide-react";
import {
  DEFAULT_VISUAL_PREFERENCES,
  readVisualPreferences,
  writeVisualPreferences,
  type VisualMode,
  type VisualPreferences,
} from "@/lib/visual-preferences";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const VISUAL_OPTIONS: Array<{
  value: VisualMode;
  label: string;
  icon: typeof Sparkles;
}> = [
  { value: "glow", label: "AI Glow", icon: Sparkles },
  { value: "simple", label: "Simples", icon: EyeOff },
];

export function VisualSettings() {
  const [preferences, setPreferences] = useState<VisualPreferences>(
    DEFAULT_VISUAL_PREFERENCES,
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function sync() {
      setPreferences(readVisualPreferences());
      setReducedMotion(mediaQuery.matches);
      setMounted(true);
    }

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  function updatePreferences(next: VisualPreferences) {
    setPreferences(next);
    writeVisualPreferences(next);
    toast.success("Preferência visual atualizada.");
  }

  function handleVisualMode(mode: VisualMode) {
    updatePreferences({ ...preferences, visualMode: mode });
  }

  function handleMotionChange(enabled: boolean) {
    updatePreferences({ ...preferences, backgroundMotion: enabled });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Visual
        </CardTitle>
        <CardDescription>Preferências locais deste navegador.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fundo</Label>
          <div className="grid grid-cols-2 gap-2">
            {VISUAL_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = preferences.visualMode === option.value;

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  disabled={!mounted}
                  onClick={() => handleVisualMode(option.value)}
                  className={cn(
                    "h-10 justify-start gap-2",
                    active && option.value === "glow" && "gradient-bg border-0 glow-soft",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <input
                id="background-motion"
                type="checkbox"
                checked={preferences.backgroundMotion}
                disabled={
                  !mounted || preferences.visualMode === "simple" || reducedMotion
                }
                onChange={(event) => handleMotionChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="background-motion"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Animação de fundo
                </Label>
                {reducedMotion && (
                  <p className="text-xs text-muted-foreground">
                    Desativada pela preferência do sistema.
                  </p>
                )}
                {preferences.visualMode === "simple" && !reducedMotion && (
                  <p className="text-xs text-muted-foreground">
                    Indisponível no modo simples.
                  </p>
                )}
              </div>
            </div>

            <Badge variant="secondary" className="shrink-0">
              {preferences.visualMode === "simple"
                ? "sem glow"
                : preferences.backgroundMotion && !reducedMotion
                  ? "animado"
                  : "estático"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
