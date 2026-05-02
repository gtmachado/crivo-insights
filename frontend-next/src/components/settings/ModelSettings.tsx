"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getModelConfig, updateModelConfig, type ModelConfigUpdate } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

const TASK_META: Record<string, { label: string; description: string }> = {
  refine: {
    label: "Refinamento",
    description:
      "Formata a transcrição bruta como diálogo e corrige erros do Whisper",
  },
  structure: {
    label: "Estruturação",
    description:
      "Transforma a transcrição refinada em entrevista estruturada com insights",
  },
  glossary: {
    label: "Glossário",
    description:
      "Extrai termos e definições técnicas do nicho a partir da entrevista",
  },
  consolidate: {
    label: "Consolidação de insights",
    description:
      "Consolida insights extraídos de múltiplas entrevistas",
  },
  consolidate_glossary: {
    label: "Consolidação de glossário",
    description:
      "Consolida glossários individuais no glossário do nicho",
  },
};

const MODEL_LABELS: Record<string, string> = {
  "anthropic/claude-sonnet-4.6": "Claude Sonnet 4.6 (recomendado)",
  "openai/gpt-4o": "GPT-4o",
  "openai/gpt-4o-mini": "GPT-4o mini",
  "google/gemini-2.5-flash": "Gemini 2.5 Flash",
  "google/gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
};

const CONFIGURABLE_TASKS = [
  "refine",
  "structure",
  "glossary",
  "consolidate",
  "consolidate_glossary",
] as const;

export function ModelSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["model-config"],
    queryFn: getModelConfig,
    retry: false,
    staleTime: 30_000,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  // Preenche o form com os overrides salvos quando os dados carregam
  useEffect(() => {
    if (data?.saved) {
      setForm(data.saved);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (update: ModelConfigUpdate) => updateModelConfig(update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-config"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast.success("Modelos salvos. Aplica a novas entrevistas.");
    },
    onError: () => {
      toast.error("Erro ao salvar modelos. Verifique o backend.");
    },
  });

  function handleSave() {
    mutation.mutate(form as ModelConfigUpdate);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando configurações de modelos…
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Não foi possível carregar configurações de modelos. Backend offline?
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modelos de IA</CardTitle>
        <CardDescription>
          Selecione o modelo LLM para cada etapa do pipeline. Aplica apenas a
          novas entrevistas processadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {CONFIGURABLE_TASKS.map((task) => {
          const meta = TASK_META[task];
          const effective = data.effective[task] ?? "";
          const saved = form[task] ?? "";

          return (
            <div key={task} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{meta.label}</Label>
                {!saved && (
                  <span className="text-xs text-muted-foreground">
                    padrão: {MODEL_LABELS[effective] ?? effective}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
              <select
                value={saved}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [task]: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
              >
                <option value="">
                  — usar padrão ({MODEL_LABELS[effective] ?? effective}) —
                </option>
                {data.allowed_models.map((m) => (
                  <option key={m} value={m}>
                    {MODEL_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        {/* niche_analysis — fixo, não editável */}
        <div className="rounded-md border border-dashed border-border p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-sm font-medium text-muted-foreground">
              Análise de nicho
            </Label>
            <Badge variant="secondary" className="text-xs">
              fixo
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Análise estratégica multi-entrevista. Sempre usa{" "}
            <span className="font-mono text-xs">anthropic/claude-sonnet-4.6</span>{" "}
            — não configurável.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="gradient-bg text-white border-0 hover:opacity-90 glow-soft gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar modelos
          </Button>
          {mutation.isSuccess && (
            <span className="text-xs text-emerald-500">Salvo!</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
