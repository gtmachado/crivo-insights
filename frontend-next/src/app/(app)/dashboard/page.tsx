"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllJobs, getSystemStatus } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2, Clock, Cpu, Database } from "lucide-react";

const STATUS_CONFIG = {
  done:       { label: "Concluído",    icon: CheckCircle2, color: "text-green-500" },
  error:      { label: "Erro",         icon: XCircle,      color: "text-red-500"   },
  running:    { label: "Processando",  icon: Loader2,      color: "text-yellow-500 animate-spin" },
  pending:    { label: "Aguardando",   icon: Clock,        color: "text-muted-foreground" },
} as const;

const STAGE_LABELS: Record<string, string> = {
  raw:        "01 Transcrição bruta",
  refined:    "02 Refinamento",
  structured: "03 Estruturação",
  glossary:   "04 Glossário",
};

export default function DashboardPage() {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: getAllJobs,
    refetchInterval: 3000,
  });

  const { data: sysStatus } = useQuery({
    queryKey: ["system-status"],
    queryFn: getSystemStatus,
    staleTime: 60_000,
  });

  const running = jobs.filter((j) => j.status === "running").length;
  const done    = jobs.filter((j) => j.status === "done").length;
  const errors  = jobs.filter((j) => j.status === "error").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Status do pipeline em tempo real</p>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processando</p>
                <p className="text-3xl font-bold text-yellow-500">{running}</p>
              </div>
              <Loader2 className={`h-8 w-8 text-yellow-500 ${running > 0 ? "animate-spin" : ""}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-3xl font-bold text-green-500">{done}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com erros</p>
                <p className="text-3xl font-bold text-red-500">{errors}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sistema */}
      {sysStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" /> Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <Badge variant="outline">{sysStatus.llm_provider}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Whisper</span>
                <Badge variant="outline">{sysStatus.whisper_model}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Key</span>
                <Badge variant={sysStatus.api_key_configured ? "default" : "destructive"}>
                  {sysStatus.api_key_configured ? "Configurada" : "Ausente"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Structure</span>
                <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px]">
                  {sysStatus.models?.structure}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" /> Jobs de processamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum job encontrado. Faça upload de uma entrevista para começar.
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border">
                {jobs.map((job) => {
                  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <div key={job.job_id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{job.interview || "—"}</p>
                          <p className="text-xs text-muted-foreground">{job.niche || "—"} · job {job.job_id}</p>
                        </div>
                        <div className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                          {cfg.label}
                        </div>
                      </div>

                      {/* Stages */}
                      {job.paths && Object.keys(job.paths).length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.keys(STAGE_LABELS).map((stage) => (
                            <Badge
                              key={stage}
                              variant={job.paths[stage] ? "default" : "outline"}
                              className="text-xs"
                            >
                              {STAGE_LABELS[stage]}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Último log */}
                      {job.log && job.log.length > 0 && (
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          › {job.log[job.log.length - 1]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
