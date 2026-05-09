"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl, getApiSecret, setApiConfig, getSystemStatus } from "@/lib/api";
import { ModelSettings } from "@/components/settings/ModelSettings";
import { PromptSettings } from "@/components/settings/PromptSettings";
import { VisualSettings } from "@/components/settings/VisualSettings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [url, setUrl]       = useState("");
  const [secret, setSecret] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUrl(getApiUrl());
    setSecret(getApiSecret());
    setHydrated(true);
  }, []);

  const status = useQuery({
    queryKey: ["system-status", url, secret],
    queryFn: getSystemStatus,
    enabled: hydrated,
    retry: false,
    refetchInterval: 5_000,
  });

  function handleSave() {
    setApiConfig(url, secret);
    toast.success("Configuração salva. Testando conexão…");
    status.refetch();
  }

  function handleReload() {
    window.location.reload();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a URL do backend (ngrok ou local) e o token de autenticação.
        </p>
      </div>

      {/* Status da conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {status.isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> Verificando…</>
            ) : status.isError ? (
              <><AlertCircle className="h-4 w-4 text-destructive" /> Backend offline</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Backend online</>
            )}
          </CardTitle>
          <CardDescription className="text-xs font-mono">{url || "(sem URL)"}</CardDescription>
        </CardHeader>
        {status.data && (
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provider</span>
              <Badge variant="secondary">{status.data.llm_provider}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Whisper</span>
              <span className="font-mono text-xs">{status.data.whisper_model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API key configurada</span>
              {status.data.api_key_configured
                ? <Badge variant="default" className="bg-emerald-600">sim</Badge>
                : <Badge variant="destructive">não</Badge>}
            </div>
          </CardContent>
        )}
        {status.isError && (
          <CardContent className="text-xs text-muted-foreground">
            Não foi possível conectar. Verifique se o backend está rodando, se a URL
            está correta e se o token bate com <code>API_SECRET_KEY</code> do{" "}
            <code>.env</code> do backend.
          </CardContent>
        )}
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexão com o backend</CardTitle>
          <CardDescription>
            Como o ngrok grátis gera uma URL nova a cada sessão, cole aqui a URL atual
            sempre que reiniciar o túnel. Salvo no navegador (localStorage).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL do backend</Label>
            <Input
              id="url"
              placeholder="https://xxxx.ngrok-free.app"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Sem barra no final. Ex: <code>https://devotion-ultra.ngrok-free.dev</code>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret">API Secret (Bearer token)</Label>
            <Input
              id="secret"
              placeholder="Cole o API_SECRET_KEY do backend"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="font-mono text-sm"
              type="password"
            />
            <p className="text-xs text-muted-foreground">
              Tem que ser idêntico ao <code>API_SECRET_KEY</code> do{" "}
              <code>.env</code> do backend.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" /> Salvar
            </Button>
            <Button variant="outline" onClick={handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Recarregar página
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* GSD-007 — Preferências visuais */}
      <VisualSettings />

      {/* GSD-004 — Modelos de IA por etapa */}
      <ModelSettings />

      {/* GSD-005 — Prompts do sistema */}
      <PromptSettings />
    </div>
  );
}
