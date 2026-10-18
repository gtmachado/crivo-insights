# CLAUDE.md — Constituição do Crivo Insights

> Leia este arquivo antes de qualquer tarefa. Regras aqui são invioláveis.

---

## 1. Identidade do Projeto

**Crivo Insights** — plataforma interna de descoberta de mercado via entrevistas qualitativas.
- **Backend:** FastAPI + Python 3.11 em `backend/`
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS v4 + shadcn 4.5 (base-ui) em `frontend-next/`
- **Dados:** `data/niches/{nicho}/{entrevista}/` — hierarquia estrita em filesystem

---

## 2. Regras Absolutas (nunca violar)

### Código
1. **Python correto:** sempre `C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe`
2. **Sem `asChild` em Button:** shadcn 4.5 com `@base-ui/react/button` não tem essa prop. Use `<Link className={buttonVariants(...)}>` puro.
3. **Tailwind v4:** customizações via `@theme inline {}` em `globals.css`. Não existe `tailwind.config.js`.
4. **Next.js 16:** antes de escrever qualquer código de framework, confirme APIs em `frontend-next/node_modules/next/dist/docs/`.
5. **Sem modificar `backend/core/pipeline.py`:** use o padrão interceptor em `backend/services/interview_runner.py`. As mensagens de `on_step` do pipeline são um contrato (prefixos em `_STAGE_TRIGGERS`, coberto por teste).
6. **Sonnet 4.6 obrigatório na análise de nicho:** `call_with_model()` em `niche_analyzer.py`, com os modelos de `core/layout.py`. Nunca `resolve_model()`.
7. **Cores só por token** (`bg-card`, `text-muted-foreground`, `bg-success-soft`…). Nunca `emerald-*`, hex ou rgb fixos; sem `text-[Npx]` (use a escala + `text-2xs`).
8. **Nomes de arquivo, tarefas LLM e modelos fixos vivem em `backend/core/layout.py`** — não repita literais.
9. **Depois de `shadcn add`, confira imports e `package.json`:** a CLI 4.5.0 já reescreveu imports para um pacote npm `cn`; o correto é `@/lib/utils`.
10. **Validar antes de entregar:** os gates da seção 6 (todos verdes).

### Processo de trabalho — "Trilho auditável"
11. **Uma branch por mudança, sem worktree** (worktree só com autorização explícita). Nunca trabalhar direto na `main`.
12. **Etapas sequenciais, sem parada obrigatória entre elas.** Cada etapa só fecha com: gates verdes, commit(s) convencionais (`feat:`, `fix:`, `refactor:`, `docs:`) e uma entrada em `docs/refactor/LOG.md` (o quê / por quê / arquivos / evidência dos gates / riscos).
13. **Gate falhou:** corrija e repita. Após 3 tentativas sem sucesso, pare e reporte.
14. **Pare e pergunte somente se:** for preciso tocar `backend/core/pipeline.py`; a operação tocar dados reais em `data/niches/`; surgir decisão de produto fora do plano aprovado; um gate ficar travado.
15. **Plano antes de feature nova** (aprovação do usuário), mas depois de aprovado o agente segue sem pedir "pode começar" a cada etapa.
16. **Listar antes de alterar:** use Read/Glob/Grep para entender o escopo antes de qualquer Edit/Write.
17. **Verificação visual sem gastar créditos:** navegue em dados existentes; não dispare upload, transcrição nem análise de nicho só para testar.
18. **Relatório curto ao fim:** arquivos alterados, causa, como testar, pendências.

### Modelos LLM (custo)
19. **Modelo padrão da sessão:** Sonnet (ou o modelo ativo configurado). Nunca escalar sem necessidade.
20. **Opus apenas com autorização explícita** do usuário.
21. **Evitar prompts gigantes** e **reescritas de arquivo inteiro** quando um Edit cirúrgico resolve.

---

## 3. Arquitetura Resumida

```
Crivo Insights/
├── backend/
│   ├── api/
│   │   ├── main.py            # app, CORS, auth em todos os routers (exceto /health)
│   │   ├── auth.py            # verify_token (Bearer ou ?token=), compare_digest
│   │   ├── schemas.py         # modelos de entrada/saída (response_model)
│   │   └── routes/            # interviews, niches, config, media, system
│   ├── core/
│   │   ├── config.py          # settings (.env)
│   │   ├── layout.py          # nomes de arquivo, LLM_TASKS, modelos fixos — fonte única
│   │   └── pipeline.py        # ⚠️ NÃO MODIFICAR — estável
│   ├── services/
│   │   ├── interview_runner.py  # job do pipeline + derivação das etapas (interceptor)
│   │   ├── jobs.py              # JobStore em memória, thread-safe
│   │   ├── llm_client.py        # call(), call_with_model(), resolve_model()
│   │   ├── prompt_store.py      # prompts editáveis, backup/restore
│   │   ├── model_config.py      # overrides de modelo da UI (data/config/models.json)
│   │   ├── niche_analyzer.py    # análise de nicho: OpenRouter → Anthropic, Sonnet 4.6 fixo
│   │   └── converter / transcriber / refiner / structurer / glossary
│   ├── storage/filesystem.py  # toda a I/O de disco; escrita atômica; slugify
│   ├── prompts/               # refine, structure, glossary, niche_analysis (.md, PT-BR)
│   └── tests/                 # pytest (91 testes), tudo em diretório temporário
│
└── frontend-next/src/
    ├── app/
    │   ├── globals.css        # tokens "Caderno de Campo", prose, impressão
    │   ├── layout.tsx         # fontes locais (fontsource), Providers
    │   ├── (auth)/login
    │   └── (app)/             # layout com Sidebar; /print/ sem chrome
    │       ├── dashboard, upload, settings (abas)
    │       └── nicho/[nicho]  e  nicho/[nicho]/[entrevista]  (?doc= na URL)
    ├── components/            # ui (shadcn), common, layout, interview, niche, dashboard,
    │                          # pipeline, glossary, settings, editor, markdown, media, files, theme
    ├── hooks/                 # useJobs, useNicheOverview, useAnalyzeNiche, useSystemStatus, useMounted
    └── lib/                   # api.ts (ApiError), query-keys.ts, status.ts, pipeline.ts, files.ts, glossary.ts, format.ts
```

---

## 4. Nomes de Arquivos no Disco

```
{entrevista}/
  raw/                          ← original enviado pelo usuário (não modificar nunca)
  processed/                    ← WAV gerado pelo ffmpeg
  parts/                        ← chunks do Whisper
  outputs/
    01_transcricao_bruta.md     ← doc "raw"
    02_transcricao_refinada.md  ← doc "refined"
    03_entrevista_estruturada.md ← doc "structured"
  glossary/
    glossario_local.md          ← doc "glossary"
  metadata.json                 ← título, entrevistado, entrevistador, contato, observações
```

---

## 5. Stack Visual — "Caderno de Campo" (Tailwind v4, oklch)

Claro por padrão; escuro (grafite quente) é opção em Configurações → Aparência. Sem gradientes, vidro ou brilho: o
conteúdo (transcrições, análises) é o protagonista. Tokens em `frontend-next/src/app/globals.css` (`@theme inline {}`, `:root`, `.dark`).

| Token / classe | Uso |
|---|---|
| `--background` / `--card` | Papel off-white quente / superfície |
| `--foreground` / `--muted-foreground` | Tinta grafite / texto secundário |
| `--primary` | Verde-petróleo — a cor do "insight"; usar com parcimônia |
| `--highlight` | Marca-texto âmbar: seleção de texto, citações, destaques |
| `--success`, `--warning`, `--info`, `--destructive` | Tons semânticos; cada um tem `-soft` (fundo) e `-foreground` (texto) |
| `font-sans` / `font-heading` / `font-mono` | Inter / Source Serif 4 (títulos) / JetBrains Mono — locais via `@fontsource-variable` |
| `text-2xs` | Texto mínimo (11 px) |
| `.crivo-prose` | Leitura longa de markdown (72ch); `.crivo-prose--wide` remove a medida |
| `.no-print`, `.print-columns` | Impressão |

Componentes base em `components/common/`: `PageContainer`/`PageHeader`/`SectionLabel`, `EmptyState`/`ErrorState`/`LoadingState`,
`StatusBadge`, `Logo`. Status → rótulo/tom só em `lib/status.ts`.

---

## 6. Comandos de Validação (gates)

```powershell
# Backend
& "C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe" -m py_compile <arquivos .py tocados>
& "C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe" -m pytest

# Frontend
cd frontend-next; npm run lint; npx tsc --noEmit; npm run build
```

**Limpo = pytest verde + 0 problemas de lint + 0 erros TypeScript + build OK.**

O mesmo conjunto roda no GitHub Actions (`.github/workflows/ci.yml`) em todo PR e em `push` na `main`. O backend usa só `requirements-test.txt` (sem torch/whisper).

---

## 7. Fluxo do Pipeline

```
Upload (audio/video)
  → convert  (ffmpeg → WAV 16kHz mono)
  → transcribe (Whisper → 01_transcricao_bruta.md)
  → refine    (LLM → 02_transcricao_refinada.md)
  → structure (LLM → 03_entrevista_estruturada.md)
  → glossary  (LLM → glossary/glossario_local.md)
```

Etapas detectadas pelo interceptor em `interview_runner.py` — sem tocar `pipeline.py`. O job é criado **antes** da task
agendar, então `GET /interviews/status/{id}` nunca dá 404 logo após o upload.

---

## 8. Análise de Nicho

- Modelo: **Sonnet 4.6 fixo** via OpenRouter (`anthropic/claude-sonnet-4.6`), fallback Anthropic (`core/layout.py`)
- Input: `03_entrevista_estruturada.md` das entrevistas selecionadas manualmente
- Output: `data/niches/{nicho}/_insights/analise_{slug}.md`
- Prompt: `backend/prompts/niche_analysis.md`
- A consolidação automática antiga (insights/glossário do nicho) e o frontend Streamlit foram **removidos**.

---

## 9. Autenticação

- **Todas as rotas** exigem `API_SECRET_KEY` (header `Authorization: Bearer` ou `?token=`), exceto `GET /health`. Sem chave configurada = sem proteção (só dev local).
- `<audio>`/`<video>` não enviam header: `mediaUrl()` no frontend appenda `?token=…&ngrok-skip-browser-warning=true`; `/media` valida o caminho contra path traversal e implementa Range (`bytes=a-b`, `a-`, `-n`).
- CORS: `expose_headers` inclui `Content-Range`, `Accept-Ranges` (necessário para seek/duração).
- O login do app usa Supabase (guard no cliente em `(app)/layout.tsx`).

---

## 10. Rotas de Impressão

`(app)/layout.tsx` detecta `/\/print(?:$|\/)/.test(pathname)` → renderiza apenas `{children}` sem Sidebar. A única rota
de impressão hoje é `/nicho/[nicho]/[entrevista]/glossario/print` (dispara `window.print()` após 600 ms).

---

## 11. Histórico e Backlog

- GSD-001 a GSD-008 estão **concluídos** (ver `docs/gsd/`). A **Fase 5** está liberada: backlog em `docs/gsd/02_backlog.md`
  (histórico de análises, exportar PDF, busca global Ctrl+K, analytics, multiusuário…).
- A refatoração + facelift "Caderno de Campo" está registrada, etapa por etapa, em `docs/refactor/LOG.md`.
- Planos novos seguem o Trilho auditável (seção 2), não o antigo fluxo "um GSD por vez com parada".

---

## 12. Skills Disponíveis

| Arquivo | Quando usar |
|---------|-------------|
| `.claude/skills/crivo-debug.md` | Bug, erro de build, player não toca, 500/401 no backend |
| `.claude/skills/crivo-feature.md` | Feature nova |
| `.claude/skills/crivo-ui-polish.md` | Ajuste visual, tema, tokens, componentes de UI |
| `.claude/skills/crivo-prompt-config.md` | Editar prompt ou modelo LLM |
| `.claude/skills/crivo-cost-control.md` | Controle de custo, auditoria de tokens |
