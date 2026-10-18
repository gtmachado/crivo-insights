"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { errorMessage, getModelConfig, updateModelConfig, type ModelConfigUpdate } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { ErrorState, LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TASKS = [
  { id: "refine", label: "Refinamento", description: "Formata a transcrição bruta como diálogo e corrige erros do Whisper." },
  { id: "structure", label: "Estruturação", description: "Transforma a transcrição refinada em entrevista estruturada, com insights." },
  { id: "glossary", label: "Glossário", description: "Extrai termos e definições técnicas do nicho a partir da entrevista." },
] as const;

const MODEL_LABELS: Record<string, string> = {
  "anthropic/claude-sonnet-4.6": "Claude Sonnet 4.6 (recomendado)",
  "openai/gpt-4o": "GPT-4o",
  "openai/gpt-4o-mini": "GPT-4o mini",
  "google/gemini-2.5-flash": "Gemini 2.5 Flash",
  "google/gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
};
const labelOf = (model: string) => MODEL_LABELS[model] ?? model;

/** Valor sentinela do Select para "usar o padrão" (string vazia não funciona como valor). */
const DEFAULT = "default";

export function ModelSettings() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.modelConfig,
    queryFn: getModelConfig,
    retry: false,
    staleTime: 30_000,
  });

  // Só as alterações feitas pelo usuário; o resto vem do servidor. (Sem efeito de sincronização.)
  const [edits, setEdits] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (update: ModelConfigUpdate) => updateModelConfig(update),
    onSuccess: () => {
      setEdits({});
      qc.invalidateQueries({ queryKey: qk.modelConfig });
      qc.invalidateQueries({ queryKey: qk.systemStatus });
      toast.success("Modelos salvos. Valem para as próximas entrevistas.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <LoadingState lines={5} />;
  if (error || !data) {
    return <ErrorState title="Não foi possível carregar os modelos" error={error} onRetry={() => refetch()} />;
  }

  const current = (task: string) => edits[task] ?? data.saved[task] ?? "";
  const dirty = TASKS.some(({ id }) => current(id) !== (data.saved[id] ?? ""));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(Object.fromEntries(TASKS.map(({ id }) => [id, current(id)])));
      }}
    >
      <p className="text-sm text-muted-foreground">
        Escolha o modelo de cada etapa do pipeline. A mudança vale apenas para entrevistas processadas daqui para a frente.
      </p>

      {TASKS.map(({ id, label, description }) => {
        const effective = data.effective[id] ?? "";
        const value = current(id);
        const items = [
          { value: DEFAULT, label: `Padrão — ${labelOf(effective)}` },
          ...data.allowed_models.map((m) => ({ value: m, label: labelOf(m) })),
        ];
        return (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={`model-${id}`}>{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
            <Select
              value={value || DEFAULT}
              items={items}
              onValueChange={(next) => setEdits((e) => ({ ...e, [id]: next === DEFAULT ? "" : String(next) }))}
            >
              <SelectTrigger id={`model-${id}`} className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}

      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-0.5 text-sm">
          <p className="font-medium">Análise de nicho <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">fixo</span></p>
          <p className="text-xs text-muted-foreground">
            Sempre usa <span className="font-mono">{data.fixed.niche_analysis ?? "anthropic/claude-sonnet-4.6"}</span>; não é configurável.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={!dirty || save.isPending}>
        {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Salvar modelos
      </Button>
    </form>
  );
}
