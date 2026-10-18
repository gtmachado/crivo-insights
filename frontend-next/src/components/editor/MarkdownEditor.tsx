"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Editor markdown em duas colunas (texto | preview ao vivo).
 *
 * - `dirty` = diferença para `initialContent`; habilita Salvar
 * - Ctrl/Cmd+S salva; Esc cancela (pedindo confirmação se houver alterações)
 * - O estado é inicializado uma vez: o pai usa `key` por documento para
 *   remontar o editor, então uma revalidação do cache nunca apaga o que o
 *   usuário digitou.
 */
export function MarkdownEditor({
  initialContent,
  onSave,
  onCancel,
  saving = false,
  filename,
}: {
  initialContent: string;
  onSave: (content: string) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
  filename?: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = content !== initialContent;

  async function handleSave() {
    if (!dirty || saving) return;
    try {
      await onSave(content);
      toast.success("Documento salvo.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  function requestCancel() {
    if (dirty) setConfirmDiscard(true);
    else onCancel();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      requestCancel();
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate font-mono">{filename ?? "Editando documento"}</span>
          <span className={cn("shrink-0 font-medium", dirty ? "text-warning-foreground" : "text-muted-foreground/70")}>
            {dirty ? "● modificado" : "salvo"}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={requestCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!dirty || saving}>
            <Save aria-hidden /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-[60vh] grid-cols-1 md:grid-cols-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label="Conteúdo markdown"
          placeholder="Edite o markdown aqui… (Ctrl+S salva, Esc cancela)"
          className="min-h-64 resize-none border-b border-border bg-transparent p-4 font-mono text-[0.8125rem] leading-relaxed outline-none focus-visible:bg-muted/40 md:border-r md:border-b-0"
        />
        <div className="max-h-[70vh] overflow-y-auto p-4 md:p-6">
          <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização</p>
          <MarkdownPreview content={content} />
        </div>
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas. Se continuar, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onCancel}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
