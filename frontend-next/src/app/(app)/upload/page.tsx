"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { getNiches, uploadInterview } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileAudio, FileVideo, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED = {
  "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac"],
  "video/*": [".mp4", ".mkv", ".mov", ".avi", ".webm"],
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadPage() {
  const { data: niches = [] } = useQuery({ queryKey: ["niches"], queryFn: getNiches });
  const setJob = useAppStore((s) => s.setJob);

  const [file, setFile] = useState<File | null>(null);
  const [niche, setNiche] = useState("");
  const [newNiche, setNewNiche] = useState("");
  const [interviewName, setInterviewName] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const isNewNiche = niche === "__new__";
  const finalNiche = isNewNiche ? newNiche : niche;
  const canSubmit = !!file && !!finalNiche.trim() && !!interviewName.trim() && !uploading;

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
  });

  async function handleUpload() {
    if (!file || !finalNiche || !interviewName) return;
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadInterview(file, finalNiche, interviewName, setProgress);
      setJobId(result.job_id);
      setJob(result.job_id, {
        job_id: result.job_id,
        niche: finalNiche,
        interview: interviewName,
        status: "running",
        log: [],
        paths: {},
      });
      toast.success(`Pipeline iniciado! Job ID: ${result.job_id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nova Entrevista</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Faça o upload de um arquivo de áudio ou vídeo para iniciar o pipeline de processamento.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Nicho */}
          <div className="space-y-2">
            <Label>Nicho</Label>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecione um nicho...</option>
              {niches.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="__new__">+ Criar novo nicho</option>
            </select>
          </div>

          {isNewNiche && (
            <div className="space-y-2">
              <Label>Nome do novo nicho</Label>
              <Input
                placeholder="ex: Clínicas de Estética"
                value={newNiche}
                onChange={(e) => setNewNiche(e.target.value)}
              />
            </div>
          )}

          {/* Nome da entrevista */}
          <div className="space-y-2">
            <Label>Nome da entrevista</Label>
            <Input
              placeholder="ex: João Silva — Dono de Clínica"
              value={interviewName}
              onChange={(e) => setInterviewName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dropzone */}
      <Card>
        <CardHeader><CardTitle>Arquivo</CardTitle></CardHeader>
        <CardContent>
          {!file ? (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent",
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Arraste um arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">
                MP4, MKV, MOV, AVI, WEBM, MP3, WAV, M4A, OGG, FLAC
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-accent/30">
              {file.type.startsWith("video") ? (
                <FileVideo className="h-8 w-8 text-blue-500 shrink-0" />
              ) : (
                <FileAudio className="h-8 w-8 text-green-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {!uploading && (
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {uploading && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Enviando arquivo...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {jobId ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-500">Pipeline iniciado com sucesso!</p>
            <p className="text-xs text-muted-foreground">
              Job ID: <code className="font-mono">{jobId}</code> — acompanhe no Dashboard
            </p>
          </div>
          <Badge variant="outline" className="ml-auto">Em processamento</Badge>
        </div>
      ) : (
        <Button onClick={handleUpload} disabled={!canSubmit} className="w-full" size="lg">
          {uploading ? "Enviando..." : "Iniciar pipeline"}
        </Button>
      )}
    </div>
  );
}
