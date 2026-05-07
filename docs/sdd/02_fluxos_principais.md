# SDD-02 — Fluxos Principais

> Software Design Document — Crivo Insights
> Última atualização: 2026-05-03

---

## Fluxo 1 — Upload e Pipeline

```
Usuário faz upload (áudio ou vídeo)
  └─ POST /interviews/upload
       ├─ Salva em data/niches/{nicho}/{entrevista}/raw/
       ├─ Cria job_id e retorna imediatamente
       └─ Pipeline inicia em background:

         convert   → ffmpeg → WAV 16kHz mono → processed/
         transcribe → Whisper (modelo: medium) → outputs/01_transcricao_bruta.md
         refine    → LLM (_resolve_model("refine")) → outputs/02_transcricao_refinada.md
         structure  → LLM (_resolve_model("structure")) → outputs/03_entrevista_estruturada.md
         glossary  → LLM (_resolve_model("glossary")) → glossary/glossario_local.md

Frontend faz polling: GET /interviews/status/{job_id}
  └─ Retorna stages[] com status, tempo, modelo, logs
  └─ PipelineTimeline exibe progresso em tempo real
```

**Regra:** o interceptor em `_run_job()` rastreia os stages sem tocar `pipeline.py`.

---

## Fluxo 2 — Edição de Documentos

```
Usuário abre entrevista
  └─ GET /interviews/{niche}/{interview}/files   → FileExplorer (árvore de arquivos)
  └─ GET /interviews/{niche}/{interview}/{doc}   → conteúdo do documento

Usuário edita no MarkdownEditor (split view)
  └─ Ctrl+S ou botão Salvar
  └─ PUT /interviews/{niche}/{interview}/{doc}
       ├─ Tipos editáveis: raw, refined, structured, glossary
       └─ Salva em disco, retorna 200
```

---

## Fluxo 3 — Glossário

```
Por entrevista:
  └─ Gerado automaticamente no pipeline (etapa glossary)
  └─ Editável via MarkdownEditor (doc type "glossary")
  └─ Link "Ver glossário da entrevista" → /nicho/{nicho}/{entrevista}/glossario
  └─ /glossario/print → PrintLayout (window.print após 600ms)

Por nicho:
  └─ POST /niches/{niche}/consolidate/glossary
       └─ LLM lê todos glossario_local.md do nicho
       └─ Salva em data/niches/{nicho}/_glossary/glossario_nicho.md
  └─ GET /niches/{niche}/glossary → exibe GlossaryGrid
```

---

## Fluxo 4 — Análise de Nicho

```
Usuário acessa página do nicho
  └─ Lista entrevistas com elegibilidade (structured=true)
  └─ Seleciona manualmente as entrevistas a incluir
  └─ Clica "Analisar nicho"

POST /niches/{niche}/analyze
  └─ Lê 03_entrevista_estruturada.md das entrevistas selecionadas
  └─ Monta prompt com niche_analysis.md
  └─ call_with_model("anthropic/claude-sonnet-4-6", prompt)   ← modelo SEMPRE fixo
  └─ Salva em data/niches/{nicho}/_insights/analise_{slug}.md

Frontend faz polling: GET /niches/{niche}/analyze/status/{job_id}
  └─ Ao concluir: invalidateQueries, exibe NicheAnalysisTab
```

---

## Fluxo 5 — Configuração de Modelos

```
Usuário acessa Settings → aba Modelos
  └─ GET /config/models → lê data/config/models.json (ou defaults do código)
  └─ Dropdown por etapa: transcribe, refine, structure, glossary, consolidate_glossary
  └─ niche_analysis aparece como somente leitura (fixo: Sonnet 4.6)

Usuário altera e salva
  └─ PUT /config/models → salva data/config/models.json
  └─ _resolve_model(task) lê esse JSON em cada chamada LLM (sem restart)
```

---

## Fluxo 6 — Configuração de Prompts

```
Usuário acessa Settings → aba Prompts
  └─ GET /config/prompts → lista 5 prompts editáveis com metadados
  └─ GET /config/prompts/{name} → conteúdo do prompt selecionado

Usuário edita e salva
  └─ PUT /config/prompts/{name}
       ├─ Na primeira edição: salva cópia em _defaults/ (_capture_default)
       ├─ Salva backup em _backups/{name}_{timestamp}.md
       └─ Sobrescreve o arquivo .md em backend/prompts/
  └─ Efeito imediato: prompts são lidos em runtime (sem restart)

Usuário clica Restaurar padrão
  └─ POST /config/prompts/{name}/restore
       └─ Copia _defaults/{name}.md de volta para backend/prompts/{name}.md
```

---

## Fluxo 7 — Rota de Impressão

```
Usuário acessa /glossario/print
  └─ (app)/layout.tsx detecta /\/print(?:$|\/)/ no pathname
  └─ Renderiza apenas {children} — sem Sidebar, Header, AmbientBackground
  └─ GlossaryPrintLayout chama window.print() após 600ms
  └─ CSS .no-print oculta elementos de navegação
```
