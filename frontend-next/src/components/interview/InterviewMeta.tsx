"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { errorMessage, getInterviewMeta, updateInterviewMeta, type InterviewMeta as Meta } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Field = { key: keyof Meta; label: string; placeholder: string; type?: string; multiline?: boolean };

// FUTURO (BL-007 / Supabase Auth): `interviewer_name` passa a ser um <select> com os
// usuários do Supabase e o backend recebe `interviewer_user_id` (já reservado no
// metadata.json). Trocar o campo abaixo é a única mudança de UI necessária.
const FIELDS: Field[] = [
  { key: "title",             label: "Título",       placeholder: "Título da entrevista" },
  { key: "interviewee_name",  label: "Entrevistado", placeholder: "Nome completo" },
  { key: "interviewer_name",  label: "Entrevistador", placeholder: "Nome do entrevistador" },
  { key: "interviewee_email", label: "E-mail",       placeholder: "email@exemplo.com", type: "email" },
  { key: "interviewee_phone", label: "Telefone",     placeholder: "+55 11 99999-9999", type: "tel" },
  { key: "notes",             label: "Observações",  placeholder: "Notas extras", multiline: true },
];

/**
 * Dados da entrevista (metadata.json): leitura em lista de definições e, ao
 * clicar em Editar, formulário vertical. O pai usa `key` para reiniciar o
 * componente ao trocar de entrevista.
 */
export function InterviewMeta({ niche, interview }: { niche: string; interview: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Meta> | null>(null);

  const { data: meta = {} } = useQuery({
    queryKey: qk.interviewMeta(niche, interview),
    queryFn: () => getInterviewMeta(niche, interview),
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (values: Partial<Meta>) => updateInterviewMeta(niche, interview, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.interviewMeta(niche, interview) });
      qc.invalidateQueries({ queryKey: qk.interviews(niche) }); // título/entrevistado aparecem na lista
      setForm(null);
      toast.success("Dados da entrevista salvos.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (form) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        {FIELDS.map(({ key, label, placeholder, type, multiline }) => {
          const id = `meta-${key}`;
          const props = {
            id,
            placeholder,
            value: form[key] ?? "",
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setForm((f) => ({ ...f, [key]: e.target.value })),
          };
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={id} className="text-xs">{label}</Label>
              {multiline ? <Textarea {...props} rows={3} /> : <Input {...props} type={type} />}
            </div>
          );
        })}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={save.isPending} onClick={() => setForm(null)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  const rows = FIELDS.filter(({ key }) => key !== "title" && meta[key]);
  const created = formatDate(meta.created_at);

  return (
    <div className="space-y-3">
      {rows.length === 0 && !created ? (
        <p className="text-sm text-muted-foreground">Nenhum dado cadastrado.</p>
      ) : (
        <dl className="space-y-2 text-sm">
          {rows.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
              <dd className="break-words">{meta[key]}</dd>
            </div>
          ))}
          {created && (
            <div>
              <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Criada em</dt>
              <dd>{created}</dd>
            </div>
          )}
        </dl>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...meta })}>
        <Pencil aria-hidden /> Editar dados
      </Button>
    </div>
  );
}
