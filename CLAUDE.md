# CLAUDE.md — Constituição do Crivo Insights

> Leia este arquivo antes de qualquer tarefa. Regras aqui são invioláveis.

---

## 1. Identidade do Projeto

**Crivo Insights** — plataforma interna de descoberta de mercado via entrevistas qualitativas.
- **Backend:** FastAPI 0.115 + Python 3.11 em `backend/`
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS v4 + shadcn 4.5 em `frontend-next/`
- **Dados:** `data/niches/{nicho}/{entrevista}/` — hierarquia estrita em filesystem

---

## 2. Regras Absolutas (nunca violar)

### Código
1. **Python correto:** sempre `C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe`
2. **Sem `asChild` em Button:** shadcn 4.5 com `@base-ui/react/button` não tem essa prop. Use `<Link className="...">` puro.
3. **Tailwind v4:** customizações via `@theme inline {}` em `globals.css`. Não existe `tailwind.config.js`.
4. **Next.js 15:** antes de escrever qualquer código Next.js, confirme APIs em `node_modules/next/dist/docs/`.
5. **Sem modificar `pipeline.py`:** use o padrão interceptor em `_run_job` de `interviews.py`.
6. **Sonnet 4.6 obrigatório na análise de nicho:** usa `call_with_model()` em `niche_analyzer.py`. Nunca `_resolve_model()`.
7. **Validar antes de entregar:** `py_compile` em todo `.py` tocado; `npm run build` no frontend.

### Processo de trabalho
8. **Trabalhar em blocos GSD:** execute somente o bloco pedido. Nunca avance para o próximo sem autorização explícita.
9. **Nunca implementar bloco diferente do pedido:** se o usuário pede GSD-003, não tocar GSD-004 nem GSD-005.
10. **Listar arquivos antes de alterar:** use Read/Glob/Grep para entender o escopo antes de qualquer Edit/Write.
11. **Propor plano para features novas:** aguardar "pode começar" antes de escrever código.
12. **Nenhuma worktree sem autorização explícita do usuário.**
13. **Relatório curto ao fim de cada bloco:** listar arquivos alterados, causa, como testar, pendências.

### Modelos LLM (custo)
14. **Modelo padrão da sessão:** Claude Sonnet 4.6 Médio (ou o modelo ativo configurado). Nunca escalar sem necessidade.
15. **Opus apenas com autorização explícita** do usuário ("pode usar Opus" ou "use claude-opus-*").
16. **Evitar prompts gigantes:** não incluir arquivos inteiros no contexto se puder usar Read pontual.
17. **Evitar reescrever arquivos completos** se um Edit cirúrgico resolve.

---

## 3. Arquitetura Resumida

```
Crivo Insights/
├── backend/
│   ├── api/
│   │   ├── main.py            # FastAPI app, verify_token (header + ?token=), /media, CORS
│   │   └── routes/
│   │       ├── interviews.py  # Pipeline interceptor, stages[], CRUD, FileExplorer
│   │       └── niches.py      # Consolidação legada + análise de nicho (Fase 4)
│   ├── services/
│   │   ├── pipeline.py        # ⚠️ NÃO MODIFICAR — estável
│   │   ├── llm_client.py      # call_llm(), call_with_model() para modelo fixo
│   │   ├── niche_analyzer.py  # analyze_niche(), OpenRouter → Anthropic fallback
│   │   └── consolidator.py
│   ├── storage/
│   │   └── filesystem.py      # Toda I/O de disco; slugify, paths, list_*
│   └── prompts/
│       └── niche_analysis.md  # Prompt PT-BR para Sonnet 4.6
│
└── frontend-next/src/
    ├── app/
    │   ├── layout.tsx                              # ThemeProvider, suppressHydrationWarning
    │   └── (app)/
    │       ├── layout.tsx                          # Detecta /print/, renderiza sem sidebar
    │       ├── settings/page.tsx                   # Configurações de API, URL
    │       ├── nicho/[nicho]/page.tsx              # Seleção de entrevistas, tabs, análise
    │       └── nicho/[nicho]/[entrevista]/page.tsx # Editor, FileExplorer, Player, Timeline
    ├── components/
    │   ├── editor/MarkdownEditor.tsx
    │   ├── effects/AmbientBackground.tsx           # Blobs CSS animados
    │   ├── files/FileExplorer.tsx
    │   ├── glossary/{GlossaryCard,Detail,Grid,Panel,PrintLayout}.tsx
    │   ├── interview/{InterviewHeader,DeleteInterviewDialog}.tsx
    │   ├── layout/{Header,Sidebar}.tsx
    │   ├── markdown/MarkdownPreview.tsx            # react-markdown + crivo-prose
    │   ├── media/MediaPlayer.tsx
    │   ├── niche/{AnalyzeNicheButton,NicheAnalysisTab}.tsx
    │   ├── pipeline/{PipelineTimeline,PipelineStageDetails}.tsx
    │   └── theme/{ThemeProvider,ThemeToggle}.tsx
    └── lib/
        ├── api.ts        # Axios, getApiUrl/Secret, todos os endpoints
        ├── store.ts      # Zustand: currentFile, setCurrentFile
        ├── files.ts      # detectKind, formatSize, FILENAME_TO_DOC
        ├── pipeline.ts   # stagesFromInterview, slugify, aggregateStatus
        └── glossary.ts   # parseGlossaryMarkdown, filterTerms
```

---

## 4. Nomes de Arquivos no Disco

```
{entrevista}/
  raw/                          ← original enviado pelo usuário (não modificar nunca)
  processed/                    ← WAV gerado pelo ffmpeg
  parts/                        ← chunks do Whisper
  outputs/
    01_transcricao_bruta.md     ← doc type "raw"
    02_transcricao_refinada.md  ← doc type "refined"
    03_entrevista_estruturada.md ← doc type "structured"
  glossary/
    glossario_local.md          ← doc type "glossary"
  meta.json                     ← metadados (a criar: GSD-002)
```

---

## 5. Stack Visual (Tailwind v4 oklch)

Tokens em `frontend-next/src/app/globals.css` dentro de `@theme inline {}` e `:root`/`.dark`.

| Token/Classe | Uso |
|---|---|
| `--primary` | Azul índigo |
| `--accent` | Violeta |
| `--gradient-from/via/to` | Gradiente azul→violeta |
| `.gradient-text` | Texto com gradiente |
| `.gradient-bg` | Fundo gradiente (botões primários) |
| `.glass` | `backdrop-blur(14px)` + border sutil |
| `.glass-strong` | Glass opaco (modais) |
| `.glow-primary/soft` | Box-shadow brilho |
| `.crivo-prose` | Container react-markdown |
| `.no-print` | `display:none` em `@media print` |

---

## 6. Comandos de Validação

```powershell
# Backend — validar sintaxe Python
& "C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe" -m py_compile `
  backend/api/main.py `
  backend/api/routes/interviews.py `
  backend/api/routes/niches.py `
  backend/services/niche_analyzer.py `
  backend/services/llm_client.py `
  backend/storage/filesystem.py

# Frontend — TypeScript + build
cd frontend-next; npm run build
```

**Build limpo = 0 erros Python + 0 erros TypeScript.**

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

Stages detectados via interceptor em `_run_job()` — sem tocar `pipeline.py`.

---

## 8. Análise de Nicho (Fase 4)

- Modelo: **Sonnet 4.6 fixo** via OpenRouter (`anthropic/claude-sonnet-4-6`), fallback Anthropic
- Input: `03_entrevista_estruturada.md` das entrevistas selecionadas manualmente
- Output: `data/niches/{nicho}/_insights/analise_{slug}.md`
- Prompt: `backend/prompts/niche_analysis.md` — 6 seções, PT-BR, sem invenção

---

## 9. Autenticação de Mídia

`<audio>`/`<video>` não enviam header `Authorization`.
- Backend: `verify_token()` aceita `?token=X` como fallback
- Frontend: `mediaUrl()` appenda `?token=...&ngrok-skip-browser-warning=true`
- CORS: `expose_headers` inclui `Content-Range`, `Accept-Ranges` (necessário para seek/duração)

---

## 10. Rotas de Impressão

`(app)/layout.tsx` detecta `/\/print(?:$|\/)/.test(pathname)` → renderiza apenas `{children}` sem Sidebar/Header/AmbientBackground.

---

## 11. Workflow GSD

O trabalho de melhoria do produto é organizado em blocos GSD no arquivo `docs/gsd/01_correcoes_prioritarias.md`.

**Ordem atual:**
1. GSD-001 — Player de mídia *(parcialmente concluído)*
2. GSD-002 — Metadata de entrevista
3. GSD-003 — Refine com separação de participantes
4. GSD-004 — Config de modelos via UI
5. GSD-005 — Config de prompts via UI
6. GSD-006 — Glossário ajustado
7. GSD-007 — Tema/fundo/light mode
8. GSD-008 — Limpeza da análise de nicho

**Fase 5 (features novas) está pausada** até GSD-001 a GSD-008 estarem concluídos.

---

## 12. Skills Disponíveis

| Arquivo | Quando usar |
|---------|-------------|
| `.claude/skills/crivo-debug.md` | Bug, erro de build, player não toca, 500 no backend |
| `.claude/skills/crivo-feature.md` | Feature nova (GSD-002, GSD-003, GSD-006, GSD-008) |
| `.claude/skills/crivo-ui-polish.md` | Ajuste visual, tema, animação (GSD-007) |
| `.claude/skills/crivo-prompt-config.md` | Editar prompt ou modelo LLM (GSD-004, GSD-005) |
| `.claude/skills/crivo-cost-control.md` | Controle de custo, auditoria de tokens |
