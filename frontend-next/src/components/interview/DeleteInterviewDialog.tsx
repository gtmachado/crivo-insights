"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Corpo do diálogo. Só existe enquanto aberto, então o campo digitado nasce vazio a cada abertura. */
function DeleteForm({
  interview,
  onCancel,
  onConfirm,
  isDeleting,
}: {
  interview: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const [typed, setTyped] = useState("");
  const valid = typed.trim() === interview;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="confirm-name">
          Para confirmar, digite <code className="font-mono font-semibold">{interview}</code>
        </Label>
        <Input
          id="confirm-name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="font-mono"
          placeholder={interview}
          disabled={isDeleting}
          autoComplete="off"
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isDeleting}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={!valid || isDeleting}>
          <Trash2 aria-hidden />
          {isDeleting ? "Excluindo…" : "Excluir definitivamente"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Confirmação forte para excluir uma entrevista: é preciso digitar o nome
 * exato. Apaga a pasta inteira (original, transcrições, glossário, partes).
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
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isDeleting && onClose()}>
      <DialogContent showCloseButton={!isDeleting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" aria-hidden />
            Excluir entrevista
          </DialogTitle>
          <DialogDescription>
            {niche} › {interview}. Esta ação <strong className="text-foreground">não pode ser desfeita</strong>:
            o áudio/vídeo original, as transcrições, o glossário e os arquivos intermediários serão
            removidos permanentemente do disco.
          </DialogDescription>
        </DialogHeader>
        <DeleteForm interview={interview} onCancel={onClose} onConfirm={onConfirm} isDeleting={isDeleting} />
      </DialogContent>
    </Dialog>
  );
}
