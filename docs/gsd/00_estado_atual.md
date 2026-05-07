# GSD-00 — Estado Atual do Crivo Insights

> Última atualização: 2026-05-03
> Build: limpo (12 rotas Next.js, 0 erros TypeScript, 0 erros Python)
> Status: **Fases 0–4 concluídas. GSD-001–006 concluídos. GSD-007–008 pendentes. Fase 5 pausada.**

---

## Fases Concluídas

### Fase 0 — Fundações Visuais ✅
- Tema claro/escuro via `next-themes 0.4.6` com tokens oklch (azul + violeta)
- AmbientBackground com 3 blobs CSS animados (`blob-drift-a/b/c`)
- ThemeToggle no Header (sun/moon, sem hydration flash)
- Glass morphism: `.glass`, `.glass-strong` com `backdrop-blur(14px)`
- `_tmp` filtrado: `_is_private_dirname()` oculta dirs de sistema da listagem de nichos
- MarkdownPreview: `react-markdown` + `remark-gfm` + `rehype-highlight`

### Fase 1 — Editor, Files, Delete, Player ✅
- FileExplorer: árvore de arquivos em 5 subdirs (outputs, glossary, raw, processed, parts)
- MarkdownEditor: split view textarea + preview, Ctrl+S, dirty state
- MediaPlayer: player de áudio (disco visual) e vídeo (full-bleed)
- DeleteInterviewDialog: confirmação por digitação do nome exato
- InterviewHeader: breadcrumb, toggle Editar/Visualizar, botão Excluir
- Endpoints: `GET /files`, `PUT /{doc}`, `DELETE /{interview}`
- Auth de mídia: `verify_token()` aceita `?token=` (necessário para tags `<audio>`/`<video>`)

### Fase 2 — Pipeline Timeline ✅
- PipelineTimeline: modo horizontal (entrevista) e vertical (dashboard)
- 6 stages: upload → convert → transcribe → refine → structure → glossary
- Detalhes por stage: tempo decorrido, modelo, logs, erro
- Interceptor pattern em `_run_job()` — sem tocar `pipeline.py`
- Fallback de stages via booleans da entrevista

### Fase 3 — Glossário Refatorado ✅
- GlossaryGrid: busca + filtro A-Z + grid 3 colunas + painel inline (XL) / drawer (mobile)
- GlossaryDetail: definição, contexto, termos relacionados, busca no Google
- GlossaryPrintLayout: `window.print()` após 600ms, 2 colunas
- GlossaryPanel: modo compacto (sidebar), link "maximizar"
- Rotas: `/glossario` e `/glossario/print` para entrevista e nicho

### Fase 4 — Análise de Nicho Manual ✅
- Seleção de entrevistas com checkboxes e "Selecionar todas"
- Elegibilidade: apenas entrevistas com `structured=true`
- AnalyzeNicheButton: polling a cada 2s, invalidate cache ao concluir
- NicheAnalysisTab: query com staleTime 30s, empty state contextual
- Modelo fixo: Claude Sonnet 4.6 via OpenRouter, fallback Anthropic
- Output: `data/niches/{nicho}/_insights/analise_{slug}.md`
- Prompt: `backend/prompts/niche_analysis.md` — 6 seções PT-BR

---

## Problemas e Ajustes Conhecidos (Fase de Correções)

Os itens abaixo foram identificados após as Fases 0–4 e estão documentados em `docs/gsd/01_correcoes_prioritarias.md`.

| GSD | Título | Status |
|-----|--------|--------|
| GSD-001 | Player de mídia (duração 0, não toca) | ✅ Concluído |
| GSD-002 | Metadata de entrevista | ✅ Concluído |
| GSD-003 | Refine com separação de participantes | ✅ Concluído |
| GSD-004 | Configurações de modelos via UI | ✅ Concluído |
| GSD-005 | Configurações de prompts editáveis | ✅ Concluído |
| GSD-006 | Ajuste de glossário | ✅ Concluído |
| GSD-007 | Tema/fundo/light mode | ⬜ Pendente |
| GSD-008 | Limpeza da análise de nicho | ⬜ Pendente |

---

## Estrutura de Dados em Disco

```
data/
└── niches/
    └── {nicho}/
        ├── _insights/
        │   ├── 01_insights_consolidados.md     ← consolidação legada
        │   └── analise_{slug}.md               ← análise manual Fase 4
        ├── _glossary/
        │   └── glossario_nicho.md
        └── {entrevista}/
            ├── raw/            ← arquivo original (áudio/vídeo) — NUNCA MODIFICAR
            ├── processed/      ← WAV gerado pelo ffmpeg
            ├── parts/          ← chunks do Whisper
            ├── outputs/
            │   ├── 01_transcricao_bruta.md        ← doc type "raw"
            │   ├── 02_transcricao_refinada.md     ← doc type "refined"
            │   └── 03_entrevista_estruturada.md   ← doc type "structured"
            └── glossary/
                └── glossario_local.md             ← doc type "glossary"
            metadata.json                          ← metadados (GSD-002 ✅)
```

---

## Endpoints da API

### Entrevistas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/interviews/{niche}` | Listar entrevistas com stages (booleans) |
| POST | `/interviews/upload` | Upload + início do pipeline |
| GET | `/interviews/status/{job_id}` | Status do job com stages[] detalhados |
| GET | `/interviews/{niche}/{interview}/{doc}` | Ler documento |
| PUT | `/interviews/{niche}/{interview}/{doc}` | Salvar documento (raw/refined/structured/glossary) |
| GET | `/interviews/{niche}/{interview}/files` | Listar arquivos da entrevista (FileExplorer) |
| DELETE | `/interviews/{niche}/{interview}` | Excluir entrevista |

### Nichos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/niches/` | Listar nichos |
| POST | `/niches/{niche}/consolidate/insights` | Consolidar insights (legado) |
| POST | `/niches/{niche}/consolidate/glossary` | Consolidar glossário |
| GET | `/niches/{niche}/insights` | Insights consolidados |
| GET | `/niches/{niche}/glossary` | Glossário do nicho |
| POST | `/niches/{niche}/analyze` | Iniciar análise de nicho (Fase 4) |
| GET | `/niches/{niche}/analyze/status/{job_id}` | Status da análise |
| GET | `/niches/{niche}/analysis` | Resultado da análise |

### Sistema
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/status` | Status do sistema, modelos configurados |
| GET | `/media/{niche}/{interview}/{filename}` | Servir mídia com Range support |

### Configuração
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/config/models` | Ler configuração de modelos por etapa |
| PUT | `/config/models` | Salvar configuração de modelos |
| GET | `/config/prompts` | Listar prompts editáveis com metadados |
| GET | `/config/prompts/{name}` | Ler conteúdo de um prompt |
| PUT | `/config/prompts/{name}` | Salvar prompt editado (com backup automático) |
| POST | `/config/prompts/{name}/restore` | Restaurar prompt ao estado de fábrica |

---

## Stack Tecnológica

### Backend
- FastAPI 0.115 + Uvicorn
- Pydantic v2
- httpx (chamadas LLM)
- OpenAI Whisper (local)
- Python 3.11 (`C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe`)

### Frontend
- Next.js 15 / React 19
- Tailwind CSS v4 (sem `tailwind.config.js`)
- shadcn 4.5 (`@base-ui/react` — sem `asChild`)
- next-themes 0.4.6
- @tanstack/react-query v5
- zustand v5
- react-markdown + remark-gfm + rehype-highlight
- axios + sonner + lucide-react
