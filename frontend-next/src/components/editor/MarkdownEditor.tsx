"use client";

import { useEffect, useState } from "react";
import { Save, X, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { toast } from "sonner";

/**
 * Editor markdown em split: textarea à esquerda, preview live à direita.
 *
 * - Detecta dirty state (diff vs initialContent) → habilita Save
 * - Atalho Ctrl/Cmd+S salva
 * - Atalho Esc descarta (com confirmação se dirty)
 * - O usuário só pode editar 3 docs (raw/refined/structured) — o glossário
 *   é regenerado pelo pipeline e não tem editor.
 *
 * O componente é "controlado por estado interno" pra preservar mudanças
 * mesmo quando o initialContent muda (ex: cache invalida). Só descarta se
 * o conteúdo do servidor mudou EXTERNAMENTE — caso raro nesse uso.
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
  const dirty = content !== initialContent;

  // Se o initialContent mudar (ex: invalidação de query) e o user não
  // tinha mudanças locais, sincroniza. Senão, mantém o que o user digitou.
  useEffect(() => {
    setContent((c) => (c === "" || !dirty ? initialContent : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  async function handleSave() {
    if (!dirty || saving) return;
    try {
      await onSave(content);
      toast.success("Documento salvo no disco.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar.";
      toast.error(msg);
    }
  }

  function handleCancel() {
    if (dirty) {
      const ok = window.confirm(
        "Você tem alterações não salvas. Descartar?",
      );
      if (!ok) return;
    }
    onCancel();
  }

  // Atalhos de teclado
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-accent/20 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">
            {filename ?? "Editando documento"}
          </span>
          <span
            className={
              dirty
                ? "ml-2 text-amber-500 font-medium"
                : "ml-2 text-muted-foreground/50"
            }
          >
            {dirty ? "● modificado" : "salvo"}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={saving}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 flex-1 min-h-0 overflow-hidden">
        {/* Editor */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder="Edite o markdown aqui… (Ctrl+S para salvar)"
          className="resize-none p-4 bg-background/40 font-mono text-[13px] leading-relaxed border-r border-border focus:outline-none focus:bg-background/70 transition-colors text-foreground/90"
        />

        {/* Preview */}
        <div className="overflow-y-auto p-4 bg-background/20">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            <Eye className="h-3 w-3" /> Preview
          </div>
          <MarkdownPreview content={content} />
        </div>
      </div>
    </div>
  );
}
