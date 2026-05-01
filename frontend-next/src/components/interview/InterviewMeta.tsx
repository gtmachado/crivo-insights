"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInterviewMeta,
  updateInterviewMeta,
  type InterviewMeta,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Save, X, User, UserCheck } from "lucide-react";

/**
 * Painel de metadata da entrevista.
 *
 * Modo compacto (default): strip horizontal com entrevistado / entrevistador.
 * Clicando "Editar" expande para form completo (2 colunas).
 *
 * ─── FUTURO (BL-007 / Supabase Auth) ────────────────────────────────────────
 * O campo `interviewer_name` é atualmente um <input> de texto livre.
 * Quando a autenticação Supabase for implementada:
 *   1. Substituir por <select> populado via GET /auth/users (Supabase admin API)
 *   2. Enviar `interviewer_user_id` (UUID do usuário) junto com o nome
 *   3. O backend pode validar o ID e derivar o nome do perfil automaticamente
 * O campo `interviewer_user_id` já existe em InterviewMeta e no metadata.json
 * exatamente para facilitar essa migração sem breaking change.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function InterviewMeta({
  niche,
  interview,
}: {
  niche: string;
  interview: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<InterviewMeta>>({});

  const { data: meta = {} } = useQuery({
    queryKey: ["interview-meta", niche, interview],
    queryFn: () => getInterviewMeta(niche, interview),
    staleTime: 5 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: () => updateInterviewMeta(niche, interview, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interview-meta", niche, interview] });
      setEditing(false);
      toast.success("Metadata salva.");
    },
    onError: () => toast.error("Erro ao salvar metadata."),
  });

  // Reset ao trocar de entrevista
  useEffect(() => {
    setEditing(false);
    setForm({});
  }, [niche, interview]);

  function startEdit() {
    setForm({ ...meta });
    setEditing(true);
  }

  function set(field: keyof InterviewMeta, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // ── Modo edição ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="px-5 py-3 border-b border-border bg-background/30 backdrop-blur-sm shrink-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {/* Linha 1 */}
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input
              className="h-7 text-xs"
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Título da entrevista"
            />
          </div>

          {/*
           * FUTURO (BL-007): substituir este <Input> por <select> com usuários
           * Supabase. Ver comentário no topo do arquivo para o plano de migração.
           */}
          <div className="space-y-1">
            <Label className="text-xs">Entrevistador</Label>
            <Input
              className="h-7 text-xs"
              value={form.interviewer_name ?? ""}
              onChange={(e) => set("interviewer_name", e.target.value)}
              placeholder="Nome do entrevistador"
            />
          </div>

          {/* Linha 2 */}
          <div className="space-y-1">
            <Label className="text-xs">Entrevistado</Label>
            <Input
              className="h-7 text-xs"
              value={form.interviewee_name ?? ""}
              onChange={(e) => set("interviewee_name", e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Telefone{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              className="h-7 text-xs"
              value={form.interviewee_phone ?? ""}
              onChange={(e) => set("interviewee_phone", e.target.value)}
              placeholder="+55 11 99999-9999"
              type="tel"
            />
          </div>

          {/* Linha 3 */}
          <div className="space-y-1">
            <Label className="text-xs">
              E-mail{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              className="h-7 text-xs"
              value={form.interviewee_email ?? ""}
              onChange={(e) => set("interviewee_email", e.target.value)}
              placeholder="email@exemplo.com"
              type="email"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Observações{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              className="h-7 text-xs"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas extras"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 gradient-bg text-white border-0 hover:opacity-90 glow-soft"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-3 w-3" />
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5"
            onClick={() => setEditing(false)}
            disabled={saveMutation.isPending}
          >
            <X className="h-3 w-3" />
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ── Modo compacto (read) ──────────────────────────────────────────────────────
  const hasData = !!(meta.interviewee_name || meta.interviewer_name || meta.title);

  return (
    <div className="px-5 py-2 border-b border-border bg-background/20 backdrop-blur-sm shrink-0 flex items-center gap-4 min-w-0">
      {hasData ? (
        <div className="flex items-center gap-4 flex-1 min-w-0 text-xs text-muted-foreground">
          {meta.interviewee_name && (
            <span className="flex items-center gap-1.5 min-w-0 shrink-0">
              <User className="h-3 w-3 shrink-0 text-primary/60" />
              <span className="truncate">{meta.interviewee_name}</span>
            </span>
          )}
          {meta.interviewer_name && (
            <span className="flex items-center gap-1.5 min-w-0 shrink-0">
              <UserCheck className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              <span className="truncate">{meta.interviewer_name}</span>
            </span>
          )}
          {meta.interviewee_email && (
            <span className="truncate hidden lg:inline text-muted-foreground/50">
              {meta.interviewee_email}
            </span>
          )}
          {!meta.interviewee_name && !meta.interviewer_name && meta.title && (
            <span className="truncate font-medium text-foreground/70">{meta.title}</span>
          )}
        </div>
      ) : (
        <p className="flex-1 text-xs text-muted-foreground/40 italic">
          Sem metadata — clique em Editar para adicionar.
        </p>
      )}

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground shrink-0"
        onClick={startEdit}
        title="Editar metadata da entrevista"
      >
        <Pencil className="h-3 w-3" />
        Editar
      </Button>
    </div>
  );
}
