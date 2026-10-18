"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { errorMessage, getApiSecret, getApiUrl, setApiConfig, testConnection } from "@/lib/api";
import { useMounted } from "@/hooks/useMounted";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Situação da conexão atualmente salva (atualiza a cada 5 s enquanto a aba está aberta). */
function CurrentStatus() {
  const { data, isLoading, error } = useSystemStatus({ refetchInterval: 5_000 });

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Conexão atual</p>
        {isLoading ? (
          <StatusBadge tone="info" label="Verificando…" />
        ) : error ? (
          <StatusBadge tone="danger" label="Offline" />
        ) : (
          <StatusBadge tone="success" label="Online" />
        )}
      </div>
      <p className="break-all font-mono text-xs text-muted-foreground">{getApiUrl()}</p>
      {data && (
        <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
          <div>
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Provedor</dt>
            <dd>{data.llm_provider}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Whisper</dt>
            <dd className="font-mono text-xs">{data.whisper_model}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Chave de IA</dt>
            <dd>{data.api_key_configured ? "configurada" : "ausente"}</dd>
          </div>
        </dl>
      )}
      {error && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {error.message} Confira se o backend está rodando, se a URL está correta e se o token é igual ao{" "}
          <code>API_SECRET_KEY</code> do <code>.env</code> do backend.
        </p>
      )}
    </div>
  );
}

function ConnectionForm() {
  const qc = useQueryClient();
  // Os valores salvos vivem no localStorage: só podem ser lidos depois da hidratação.
  const [url, setUrl] = useState(getApiUrl);
  const [secret, setSecret] = useState(getApiSecret);

  const test = useMutation({ mutationFn: () => testConnection(url, secret) });

  function save() {
    setApiConfig(url, secret);
    qc.invalidateQueries(); // todos os dados vêm do backend: recarrega tudo com a nova conexão
    toast.success("Conexão salva.");
  }

  return (
    <form
      className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <p className="font-medium">Backend</p>
        <p className="text-sm text-muted-foreground">
          O ngrok gratuito gera uma URL nova a cada sessão: cole aqui a URL atual sempre que reiniciar o túnel.
          Fica salvo neste navegador.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="url">URL do backend</Label>
        <Input
          id="url"
          className="font-mono text-sm"
          placeholder="https://xxxx.ngrok-free.app"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            test.reset();
          }}
        />
        <p className="text-xs text-muted-foreground">Sem barra no final.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secret">Token de acesso (Bearer)</Label>
        <Input
          id="secret"
          type="password"
          autoComplete="off"
          className="font-mono text-sm"
          placeholder="Mesmo valor do API_SECRET_KEY do backend"
          value={secret}
          onChange={(e) => {
            setSecret(e.target.value);
            test.reset();
          }}
        />
      </div>

      {test.isSuccess && (
        <p role="status" className="flex items-center gap-2 text-sm text-success-foreground">
          <CheckCircle2 className="size-4" aria-hidden /> Conexão funcionando ({test.data.llm_provider}, whisper-{test.data.whisper_model}).
        </p>
      )}
      {test.isError && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive-foreground">
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {errorMessage(test.error)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit">Salvar</Button>
        <Button type="button" variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !url.trim()}>
          {test.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Testar conexão
        </Button>
      </div>
    </form>
  );
}

export function ConnectionSettings() {
  const mounted = useMounted();
  if (!mounted) return <LoadingState lines={4} />;
  return (
    <div className="space-y-4">
      <CurrentStatus />
      <ConnectionForm />
    </div>
  );
}
