"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { ApiError, errorMessage, getPrompt, getPrompts, restorePrompt, updatePrompt } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import { ErrorState, LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DESCRIPTIONS: Record<string, string> = {
  refine: "Formata a transcrição bruta como diálogo e corrige erros do Whisper.",
  structure: "Transforma a transcrição refinada em entrevista estruturada, com insights.",
  glossary: "Extrai termos e definições técnicas do nicho.",
  niche_analysis: "Gera a análise de nicho a partir das entrevistas selecionadas.",
};

export function PromptSettings() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  // Rascunhos por prompt (só o que foi editado): trocar de prompt não perde o que foi digitado.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const list = useQuery({ queryKey: qk.prompts, queryFn: getPrompts });
  const prompts = list.data ?? [];
  const name = selected ?? prompts[0]?.name ?? null;

  const content = useQuery({
    queryKey: qk.prompt(name ?? ""),
    queryFn: () => getPrompt(name as string),
    enabled: name !== null,
  });

  const draft = name !== null ? drafts[name] : undefined;
  const text = draft ?? content.data?.content ?? "";
  const dirty = draft !== undefined && draft !== content.data?.content;

  function clearDraft(key: string) {
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key)));
  }

  function refresh(key: string) {
    qc.invalidateQueries({ queryKey: qk.prompt(key) });
    qc.invalidateQueries({ queryKey: qk.prompts });
  }

  const save = useMutation({
    mutationFn: (key: string) => updatePrompt(key, drafts[key] ?? ""),
    onSuccess: (_, key) => {
      clearDraft(key);
      refresh(key);
      toast.success("Prompt salvo. Vale para o próximo processamento.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const restore = useMutation({
    mutationFn: (key: string) => restorePrompt(key),
    onSuccess: (_, key) => {
      clearDraft(key);
      refresh(key);
      toast.success("Prompt restaurado ao padrão.");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) toast.info("Este prompt nunca foi modificado: já está no padrão.");
      else toast.error(errorMessage(e));
    },
  });

  if (list.isLoading) return <LoadingState lines={6} />;
  if (list.error) return <ErrorState title="Não foi possível carregar os prompts" error={list.error} onRetry={() => list.refetch()} />;

  const busy = save.isPending || restore.isPending;

  return (
    <div className="space-y-4">
      <p className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-sm", TONE.warning.soft)}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        Alterações valem para os próximos processamentos. Entrevistas já processadas não são reprocessadas automaticamente.
      </p>

      <div role="group" aria-label="Prompts" className="flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <Button
            key={p.name}
            aria-pressed={p.name === name}
            variant={p.name === name ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelected(p.name)}
          >
            {p.label}
            {(p.has_default || drafts[p.name] !== undefined) && (
              <span className="ml-1 rounded-full bg-background px-1.5 text-2xs font-medium text-muted-foreground">
                {drafts[p.name] !== undefined ? "não salvo" : "editado"}
              </span>
            )}
          </Button>
        ))}
      </div>

      {name && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{DESCRIPTIONS[name]}</p>
          {content.isLoading ? (
            <LoadingState lines={8} />
          ) : content.error ? (
            <ErrorState error={content.error} onRetry={() => content.refetch()} />
          ) : (
            <Textarea
              aria-label="Conteúdo do prompt"
              value={text}
              onChange={(e) => setDrafts((d) => ({ ...d, [name]: e.target.value }))}
              rows={18}
              className="resize-y font-mono text-xs"
              placeholder="Conteúdo do prompt…"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy || !dirty || !text.trim()} onClick={() => save.mutate(name)}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Salvar
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => restore.mutate(name)}>
              {restore.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
              Restaurar padrão
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
          </div>
        </div>
      )}
    </div>
  );
}
