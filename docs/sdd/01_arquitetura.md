# SDD-01 — Arquitetura e Stack

> Software Design Document — Crivo Insights
> Última atualização: 2026-05-03

---

## Stack

### Backend
- **FastAPI 0.115** + Uvicorn (ASGI)
- **Python 3.11** — executável: `C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe`
- **Pydantic v2** com `pydantic-settings` (`.env` tem prioridade sobre defaults de código)
- **httpx** para chamadas HTTP a LLMs externos
- **OpenAI Whisper** (local, modelo versionado: `medium`)

### Frontend
- **Next.js 15 / React 19** — APIs podem diferir do treinamento; sempre confirmar em `node_modules/next/dist/docs/`
- **Tailwind CSS v4** — sem `tailwind.config.js`; customizações via `@theme inline {}` em `globals.css`
- **shadcn 4.5** com `@base-ui/react` — sem prop `asChild` em Button
- **@tanstack/react-query v5** — `useQuery` + `useMutation` + `invalidateQueries`
- **zustand v5** — estado global mínimo (`currentFile`)
- next-themes 0.4.6, axios, sonner, lucide-react

---

## Estrutura de Diretórios

```
Crivo Insights/
├── backend/
│   ├── api/
│   │   ├── main.py            # App FastAPI, CORS, /media, verify_token
│   │   └── routes/
│   │       ├── interviews.py  # Pipeline interceptor, CRUD, FileExplorer
│   │       ├── niches.py      # Análise de nicho, consolidação
│   │       └── config.py      # GET/PUT /config/models, GET/PUT/POST /config/prompts
│   ├── core/
│   │   ├── config.py          # Settings (pydantic-settings)
│   │   └── pipeline.py        # ⚠️ NÃO MODIFICAR — estável
│   ├── services/
│   │   ├── llm_client.py      # call_llm(), call_with_model(), _resolve_model()
│   │   ├── refiner.py         # refine_transcription() com separação de participantes
│   │   ├── niche_analyzer.py  # analyze_niche() — Sonnet 4.6 fixo
│   │   └── consolidator.py
│   ├── storage/
│   │   └── filesystem.py      # Toda I/O de disco; slugify, paths, read/write_model_config
│   └── prompts/
│       ├── refine_prompt.md
│       ├── structure_prompt.md
│       ├── glossary_prompt.md
│       ├── consolidate_glossary_prompt.md
│       ├── niche_analysis.md   # Prompt PT-BR — Sonnet 4.6 fixo
│       ├── _backups/           # gitignored — backups automáticos
│       └── _defaults/          # gitignored — cópia fábrica para restore
│
├── data/
│   ├── niches/                 # Dados das entrevistas (ver SDD-03)
│   └── config/
│       └── models.json         # gitignored — modelos configurados via UI
│
└── frontend-next/src/
    ├── app/
    │   ├── layout.tsx                              # ThemeProvider
    │   └── (app)/
    │       ├── layout.tsx                          # Detecta /print/, oculta UI
    │       ├── settings/page.tsx                   # ModelSettings + PromptSettings + API config
    │       ├── nicho/[nicho]/page.tsx              # Seleção de entrevistas + análise
    │       └── nicho/[nicho]/[entrevista]/page.tsx # Editor, FileExplorer, Player, Timeline
    ├── components/              # Componentes React (ver CLAUDE.md §3)
    └── lib/
        ├── api.ts        # Axios + todos os endpoints tipados
        ├── store.ts      # Zustand
        ├── files.ts      # detectKind, FILENAME_TO_DOC
        ├── pipeline.ts   # stagesFromInterview, aggregateStatus
        └── glossary.ts   # parseGlossaryMarkdown
```

---

## Padrões de Código

### Backend

| Padrão | Descrição |
|---|---|
| Interceptor em `_run_job()` | Rastrear stages sem tocar `pipeline.py` |
| `call_with_model(model, prompt)` | LLM com modelo explícito (niche_analysis) |
| `call_llm(task, prompt)` | LLM com `_resolve_model(task)` (demais etapas) |
| `_resolve_model(task)` | Prioridade: `models.json` → `.env` → código |
| `read_meta(niche, interview)` | Lê `metadata.json` da entrevista |
| `slugify(text)` | Normalização de nomes (filesystem) |

### Frontend

| Padrão | Descrição |
|---|---|
| React Query para toda I/O | Sem `useState` manual para dados remotos |
| `invalidateQueries` em `onSuccess` | UI atualiza sem F5 |
| `dirty` state em editors | Evita sobrescrever edição em andamento no refetch |
| `<Link className="...">` | Nunca `<Button asChild>` (não existe no shadcn 4.5) |
| Tokens CSS via `@theme inline {}` | Nunca `tailwind.config.js` |

---

## Autenticação de Mídia

Tags `<audio>`/`<video>` não enviam header `Authorization`.
- **Backend:** `verify_token()` aceita `?token=X` como fallback
- **Frontend:** `mediaUrl()` appenda `?token=...&ngrok-skip-browser-warning=true`
- **CORS:** `expose_headers` inclui `Content-Range`, `Accept-Ranges` (necessário para seek/duração)

---

## Validação Obrigatória Antes de PR

```powershell
# Python — todo .py tocado
& "C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe" -m py_compile <arquivos>

# Frontend — se tocou .tsx/.ts
cd frontend-next; npm run build
```

Build limpo = 0 erros Python + 0 erros TypeScript.
