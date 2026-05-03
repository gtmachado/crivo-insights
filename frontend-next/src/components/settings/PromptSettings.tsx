"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPrompts,
  getPrompt,
  updatePrompt,
  restorePrompt,
  type PromptInfo,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PROMPT_DESCRIPTIONS: Record<string, string> = {
  refine:               "Formata a transcrição bruta como diálogo e corrige erros do Whisper",
  structure:            "Transforma a transcrição refinada em entrevista estruturada com insights",
  glossary:             "Extrai termos e definições técnicas do nicho",
  consolidate_glossary: "Consolida glossários individuais no glossário do nicho",
  niche_analysis:       "Gera análise de nicho a partir das entrevistas selecionadas",
};

export function PromptSettings() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft]       = useState("");
  const [dirty, setDirty]       = useState(false);

  const { data: prompts = [], isLoading: loadingList } = useQuery({
    queryKey: ["prompts-list"],
    queryFn:  getPrompts,
  });

  // Seleciona o primeiro prompt automaticamente
  useEffect(() => {
    if (prompts.length > 0 && !selected) {
      setSelected(prompts[0].name);
    }
  }, [prompts, selected]);

  const { data: promptData, isFetching: loadingContent } = useQuery({
    queryKey: ["prompt", selected],
    queryFn:  () => getPrompt(selected!),
    enabled:  !!selected,
  });

  // Sincroniza textarea com dados carregados (não sobrescreve edição em andamento)
  useEffect(() => {
    if (promptData && !dirty) {
      setDraft(promptData.content);
    }
  }, [promptData, dirty]);

  function handleSelect(name: string) {
    if (name === selected) return;
    setSelected(name);
    setDirty(false);
    setDraft("");
  }

  const saveMutation = useMutation({
    mutationFn: () => updatePrompt(selected!, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompt", selected] });
      qc.invalidateQueries({ queryKey: ["prompts-list"] });
      setDirty(false);
      toast.success("Prompt salvo com sucesso.");
    },
    onError: () => toast.error("Erro ao salvar prompt."),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restorePrompt(selected!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompt", selected] });
      qc.invalidateQueries({ queryKey: ["prompts-list"] });
      setDirty(false);
      toast.success("Prompt restaurado ao estado padrão.");
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "";
      if (detail.includes("já está no estado padrão")) {
        toast.info("Este prompt nunca foi modificado — já está no estado padrão.");
      } else {
        toast.error("Erro ao restaurar prompt.");
      }
    },
  });

  const currentPrompt = prompts.find((p: PromptInfo) => p.name === selected);
  const isBusy = saveMutation.isPending || restoreMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prompts do Sistema</CardTitle>
        <CardDescription>
          Edite os prompts usados em cada etapa do pipeline. Alterações valem
          imediatamente para os próximos processamentos.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Aviso de impacto */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Alterações nos prompts impactam os próximos processamentos.
            Entrevistas já processadas não são reprocessadas automaticamente.
          </span>
        </div>

        {/* Seletor de prompt */}
        <div className="flex flex-wrap gap-2">
          {loadingList ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            prompts.map((p: PromptInfo) => (
              <Button
                key={p.name}
                variant={selected === p.name ? "default" : "outline"}
                size="sm"
                onClick={() => handleSelect(p.name)}
                className={
                  selected === p.name
                    ? "gradient-bg text-white border-0 hover:opacity-90"
                    : ""
                }
              >
                {p.label}
                {p.has_default && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 py-0 px-1 text-[10px]"
                  >
                    editado
                  </Badge>
                )}
              </Button>
            ))
          )}
        </div>

        {/* Editor */}
        {selected && (
          <div className="space-y-3">
            {currentPrompt && (
              <p className="text-xs text-muted-foreground">
                {PROMPT_DESCRIPTIONS[selected] ?? ""}
              </p>
            )}

            {loadingContent ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : (
              <Textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDirty(true);
                }}
                rows={16}
                className="font-mono text-xs resize-y"
                placeholder="Conteúdo do prompt…"
              />
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={isBusy || !dirty || !draft.trim()}
                className="gap-2 gradient-bg text-white border-0 hover:opacity-90"
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> Salvar</>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreMutation.mutate()}
                disabled={isBusy}
                className="gap-2"
              >
                {restoreMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Restaurando…</>
                ) : (
                  <><RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão</>
                )}
              </Button>

              {dirty && (
                <span className="text-xs text-muted-foreground">
                  Alterações não salvas
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
