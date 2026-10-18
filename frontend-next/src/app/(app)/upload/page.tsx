"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileAudio, FileVideo, Upload, X } from "lucide-react";
import { errorMessage, getNiches, uploadInterview, type UploadMetadata } from "@/lib/api";
import { UPLOAD_EXTENSIONS, detectKind, formatSize } from "@/lib/files";
import { slugify } from "@/lib/pipeline";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader, SectionLabel } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NEW_NICHE = "__new__";

const ACCEPT = {
  "audio/*": UPLOAD_EXTENSIONS.filter((e) => detectKind(e) === "audio"),
  "video/*": UPLOAD_EXTENSIONS.filter((e) => detectKind(e) === "video"),
};

type Form = {
  niche: string;
  newNiche: string;
  name: string;
  title: string;
  intervieweeName: string;
  interviewerName: string;
  intervieweePhone: string;
  intervieweeEmail: string;
  notes: string;
};

/** "Juciane (1).mp3" → "Juciane (1)": sugestão de nome a partir do arquivo. */
const suggestName = (filename: string) => filename.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
    </div>
  );
}

export default function UploadPage() {
  // useSearchParams (nicho pré-selecionado) exige Suspense.
  return (
    <Suspense fallback={<PageContainer size="narrow"><LoadingState lines={5} /></PageContainer>}>
      <UploadForm />
    </Suspense>
  );
}

function UploadForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const presetNiche = useSearchParams().get("niche") ?? "";

  const { data: niches = [] } = useQuery({ queryKey: qk.niches, queryFn: getNiches });

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState<Form>({
    niche: presetNiche, newNiche: "", name: "", title: "",
    intervieweeName: "", interviewerName: "", intervieweePhone: "", intervieweeEmail: "", notes: "",
  });
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const isNewNiche = form.niche === NEW_NICHE;
  const finalNiche = (isNewNiche ? form.newNiche : form.niche).trim();

  const onDrop = useCallback((accepted: File[]) => {
    const picked = accepted[0];
    if (!picked) return;
    setFile(picked);
    setForm((f) => (f.name ? f : { ...f, name: suggestName(picked.name) }));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT, maxFiles: 1 });

  const upload = useMutation({
    mutationFn: () => {
      const metadata: UploadMetadata = {
        title: form.title || form.name,
        interviewee_name: form.intervieweeName,
        interviewer_name: form.interviewerName,
        interviewee_phone: form.intervieweePhone,
        interviewee_email: form.intervieweeEmail,
        notes: form.notes,
      };
      return uploadInterview(file as File, finalNiche, form.name.trim(), setProgress, metadata);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.niches });
      qc.invalidateQueries({ queryKey: qk.interviews(finalNiche) });
      qc.invalidateQueries({ queryKey: qk.jobs });
      toast.success("Pipeline iniciado. Acompanhe o andamento na entrevista.");
      router.push(`/nicho/${encodeURIComponent(slugify(finalNiche))}/${encodeURIComponent(slugify(form.name.trim()))}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSubmit = !!file && !!finalNiche && !!form.name.trim() && !upload.isPending;
  const FileIcon = file && detectKind(file.name) === "video" ? FileVideo : FileAudio;

  return (
    <PageContainer size="narrow">
      <PageHeader
        crumbs={[{ label: "Início", href: "/dashboard" }, { label: "Nova entrevista" }]}
        title="Nova entrevista"
        description="Envie uma gravação de áudio ou vídeo. O pipeline transcreve, refina e estrutura o conteúdo."
      />

      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) upload.mutate();
        }}
      >
        <section className="space-y-3">
          <SectionLabel>Gravação</SectionLabel>
          {!file ? (
            <div
              {...getRootProps()}
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isDragActive ? "border-primary bg-accent" : "border-input hover:border-primary/60 hover:bg-muted/50",
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Arraste um arquivo aqui ou clique para selecionar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {UPLOAD_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(", ")}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <FileIcon className="size-8 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              {!upload.isPending && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover arquivo" onClick={() => setFile(null)}>
                  <X aria-hidden />
                </Button>
              )}
            </div>
          )}
          {upload.isPending && (
            <div className="space-y-1.5" role="status">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Enviando arquivo…</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </section>

        <section className="space-y-4">
          <SectionLabel>Identificação</SectionLabel>
          <Field label="Nicho">
            <Select
              value={form.niche}
              onValueChange={(value) => set("niche", String(value))}
              items={[
                ...niches.map((n) => ({ value: n, label: n })),
                { value: NEW_NICHE, label: "Criar novo nicho…" },
              ]}
            >
              <SelectTrigger className="w-full" aria-label="Nicho">
                <SelectValue placeholder="Selecione um nicho" />
              </SelectTrigger>
              <SelectContent>
                {niches.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
                <SelectItem value={NEW_NICHE}>Criar novo nicho…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isNewNiche && (
            <Field label="Nome do novo nicho">
              <Input placeholder="ex.: Clínicas de estética" value={form.newNiche} onChange={(e) => set("newNiche", e.target.value)} />
            </Field>
          )}
          <Field label="Nome da entrevista">
            <Input placeholder="ex.: João Silva — dono de clínica" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
        </section>

        <details className="group rounded-xl ring-1 ring-foreground/10 open:bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>Participantes e observações <span className="font-normal text-muted-foreground">(opcional)</span></span>
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
            <Field label="Título" optional>
              <Input placeholder="Se vazio, usa o nome da entrevista" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Entrevistado" optional>
              <Input placeholder="Nome completo" value={form.intervieweeName} onChange={(e) => set("intervieweeName", e.target.value)} />
            </Field>
            {/* FUTURO (BL-007): <select> com os usuários do Supabase. Ver InterviewMeta.tsx. */}
            <Field label="Entrevistador" optional>
              <Input placeholder="Nome do entrevistador" value={form.interviewerName} onChange={(e) => set("interviewerName", e.target.value)} />
            </Field>
            <Field label="Telefone" optional>
              <Input type="tel" placeholder="+55 11 99999-9999" value={form.intervieweePhone} onChange={(e) => set("intervieweePhone", e.target.value)} />
            </Field>
            <Field label="E-mail" optional>
              <Input type="email" placeholder="email@exemplo.com" value={form.intervieweeEmail} onChange={(e) => set("intervieweeEmail", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observações" optional>
                <Textarea rows={3} placeholder="Contexto, combinados, pontos a investigar…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </div>
        </details>

        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
          {upload.isPending ? "Enviando…" : "Iniciar pipeline"}
        </Button>
      </form>
    </PageContainer>
  );
}
