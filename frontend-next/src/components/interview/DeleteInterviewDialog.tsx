"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Confirmação forte para deletar uma entrevista.
 * O usuário precisa digitar o nome EXATO da entrevista para liberar o botão.
 *
 * Reset do campo de input quando o diálogo abre/fecha — evita confirmar uma
 * deleção da entrevista A se o user já tinha digitado o nome dela e foi
 * direto para a B.
 */
export function DeleteInterviewDialog({
  open,
  onClose,
  interview,
  niche,
  onConfirm,
  isDeleting = false,
}: {
  open: boolean;
  onClose: () => void;
  interview: string;
  niche: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const valid = typed.trim() === interview;

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={() => !isDeleting && onClose()}
      closeOnOverlay={!isDeleting}
      hideClose={isDeleting}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold leading-tight">Excluir entrevista</h3>
            <p className="text-xs text-muted-foreground">
              {niche} › {interview}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Esta ação <strong className="text-foreground">não pode ser desfeita</strong>.
          Todos os arquivos da entrevista — incluindo o áudio/vídeo original em{" "}
          <code>raw/</code>, transcrições, glossário e parts intermediários —
          serão removidos permanentemente do disco.
        </p>

        <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 space-y-2">
          <Label htmlFor="confirm-name" className="text-xs">
            Para confirmar, digite o nome da entrevista:
          </Label>
          <p className="text-xs">
            <code className="font-mono font-semibold text-destructive">
              {interview}
            </code>
          </p>
          <Input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="font-mono text-sm"
            placeholder={interview}
            disabled={isDeleting}
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!valid || isDeleting}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
