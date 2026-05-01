"use client";

import { Pencil, Eye, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Cabeçalho da página da entrevista. Mostra niche › entrevista › arquivo atual,
 * com ações: alternar editor (se aplicável) e excluir entrevista.
 *
 * O botão Editar só aparece quando `canEdit` é true (apenas docs editáveis:
 * raw, refined, structured). Glossário local e mídia não têm botão de editar.
 */
export function InterviewHeader({
  niche,
  interview,
  currentFileName,
  editing,
  canEdit,
  onToggleEdit,
  onDelete,
}: {
  niche: string;
  interview: string;
  currentFileName?: string;
  editing: boolean;
  canEdit: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-5 py-3 border-b border-border bg-background/40 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold truncate">{interview}</h2>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <span>{niche}</span>
          {currentFileName && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <span className="font-mono">{currentFileName}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant={editing ? "secondary" : "ghost"}
            onClick={onToggleEdit}
            className="gap-1.5"
            title={editing ? "Voltar para visualização" : "Editar markdown"}
          >
            {editing ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Visualizar
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </>
            )}
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={onDelete}
          className="gap-1.5"
          title="Excluir entrevista"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Button>
      </div>
    </div>
  );
}
