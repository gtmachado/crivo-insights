# ADR-001 — Decisões Arquiteturais da Base

> Architecture Decision Record — Crivo Insights
> Data: 2026-05-03
> Status: Aceito

---

## Contexto

Este documento registra decisões arquiteturais já tomadas e estabilizadas no projeto. O objetivo é evitar que agentes futuros revertam escolhas deliberadas por desconhecimento.

---

## Decisão 1 — Filesystem como banco de dados

**Decisão:** todos os dados são armazenados em `data/niches/{nicho}/{entrevista}/` no filesystem local.

**Justificativa:**
- Uso interno, usuário único, sem necessidade de concorrência
- Sem infraestrutura de banco de dados para manter
- Arquivos `.md` são editáveis diretamente pelo usuário se necessário
- Portabilidade: backup = copiar pasta `data/`

**Consequências:** não há transações, não há rollback. Operações de escrita são diretas no disco.

---

## Decisão 2 — pipeline.py como módulo estável e inviolável

**Decisão:** `backend/core/pipeline.py` não é modificado. Extensões usam o padrão interceptor em `interviews.py`.

**Justificativa:**
- O pipeline foi estabilizado nas Fases 0–2 e funciona corretamente
- Modificações introduzem risco de regressão em fluxos já validados
- O interceptor em `_run_job()` permite adicionar rastreamento e contexto sem tocar o núcleo

**Exceção registrada:** GSD-003 (2026-05-02) — 1 linha alterada para passar `niche` e `interview_name` para `refine_transcription()`. Justificada porque os valores estão em escopo naquele ponto e não há outro caminho limpo.

---

## Decisão 3 — Sonnet 4.6 fixo para análise de nicho

**Decisão:** `niche_analyzer.py` usa `call_with_model("anthropic/claude-sonnet-4-6", ...)` diretamente, nunca `_resolve_model()`.

**Justificativa:**
- A análise de nicho é a funcionalidade de maior valor do produto
- Qualidade da análise é crítica; modelos menores (Haiku) produzem resultado inferior
- Isolar do sistema de configuração protege contra degradação acidental

**Consequência:** o UI de Settings mostra `niche_analysis` como somente leitura com badge "fixo".

---

## Decisão 4 — OpenRouter como provedor LLM primário, Anthropic como fallback

**Decisão:** chamadas LLM usam OpenRouter (`https://openrouter.ai/api/v1`) com fallback para Anthropic direto.

**Justificativa:**
- OpenRouter unifica múltiplos modelos em uma única API
- Fallback garante funcionamento mesmo sem créditos OpenRouter
- Nomes de modelos OpenRouter: `anthropic/claude-sonnet-4-6` (com hífen)
- Nomes Anthropic direto: `claude-sonnet-4-6` (sem prefixo)

---

## Decisão 5 — Tailwind CSS v4 sem tailwind.config.js

**Decisão:** customizações via `@theme inline {}` em `globals.css`. Sem arquivo de configuração Tailwind.

**Justificativa:**
- Tailwind v4 migrou para CSS-first configuration
- `tailwind.config.js` foi removido intencionalmente
- Tokens oklch permitem palette precisa (azul índigo + violeta)

**Consequência:** qualquer agente que tentar criar `tailwind.config.js` está errado.

---

## Decisão 6 — shadcn 4.5 com @base-ui/react (sem asChild)

**Decisão:** shadcn 4.5 usa `@base-ui/react` internamente. Prop `asChild` não existe.

**Justificativa:** versão 4.5 do shadcn migrou para `@base-ui/react` que não implementa o padrão Radix `asChild`.

**Consequência:** para links com estilo de botão, usar `<Link className="...">` puro.

---

## Decisão 7 — React Query para toda I/O no frontend

**Decisão:** sem `useState` manual para dados remotos. Toda leitura usa `useQuery`, toda escrita usa `useMutation` com `invalidateQueries` em `onSuccess`.

**Justificativa:**
- Cache automático, deduplicação de requests, staleTime configurável
- UI atualiza sem F5 após mutações
- `staleTime: 30_000` na análise de nicho evita refetch desnecessário de resultado já pronto

---

## Decisão 8 — Autenticação de mídia via query param

**Decisão:** `/media/{niche}/{interview}/{filename}` aceita `?token=X` além do header `Authorization`.

**Justificativa:** tags `<audio>` e `<video>` do browser não enviam headers customizados. Query param é o único mecanismo que funciona nativamente.

**Consequência:** o token aparece em logs de acesso do servidor. Aceitável para uso interno.

---

## Decisão 9 — Modelo Whisper versionado como "medium"

**Decisão:** `core/config.py` define `whisper_model = "medium"` como padrão do projeto.

**Justificativa:**
- `base` é rápido mas comete muitos erros em português técnico
- `small` melhora, mas ainda erra nomes de ferramentas e sistemas
- `medium` oferece equilíbrio adequado entre qualidade e RAM (~5GB)
- `large` é desnecessário para o contexto atual

**Trade-off:** requer ~5GB RAM para carregar. Documentado em `.env.example`.
