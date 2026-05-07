# SDD-03 — Regras de Negócio

> Software Design Document — Crivo Insights
> Última atualização: 2026-05-03
> **Estas regras são invioláveis. Qualquer agente deve respeitá-las.**

---

## Regras de Dados

### RN-001 — Raw nunca é modificado
O arquivo original enviado pelo usuário (`raw/`) jamais deve ser alterado, sobrescrito ou deletado pelo sistema.
- O pipeline opera sobre `processed/` (WAV gerado pelo ffmpeg)
- `PUT /{doc}` não aceita doc type diferente dos editáveis permitidos

### RN-002 — Hierarquia de filesystem é estrita
```
data/niches/{nicho}/{entrevista}/
  raw/            ← original — NUNCA MODIFICAR
  processed/      ← WAV gerado
  parts/          ← chunks Whisper
  outputs/        ← documentos do pipeline
  glossary/       ← glossário local
  metadata.json   ← metadados da entrevista
```
Nenhum arquivo pode ser criado fora desta hierarquia sem autorização explícita.

### RN-003 — Documentos editáveis são um conjunto fechado
Apenas `raw`, `refined`, `structured` e `glossary` aceitam PUT.
Qualquer novo doc type deve ser adicionado explicitamente ao allowlist `_EDITABLE_DOCS` em `interviews.py`.

---

## Regras de Modelos LLM

### RN-004 — Análise de nicho sempre usa Sonnet 4.6
`niche_analyzer.py` usa `call_with_model("anthropic/claude-sonnet-4-6", ...)` diretamente.
Nunca usar `_resolve_model()` lá. Nunca trocar por Haiku (perda de qualidade crítica).

### RN-005 — Opus proibido sem autorização explícita
O UI de configuração de modelos não lista Opus como opção.
`ALLOWED_MODELS` em `config.py` não inclui nenhum modelo Opus.
Só pode ser usado se o usuário escrever "pode usar Opus" ou "use claude-opus-*" no chat.

### RN-006 — Whisper medium é o padrão versionado
`core/config.py` define `whisper_model = "medium"`.
`.env.example` documenta `WHISPER_MODEL=medium`.
Downgrade para `small` ou `base` só se o usuário autorizar explicitamente.

---

## Regras de Pipeline

### RN-007 — pipeline.py não é modificado
`backend/core/pipeline.py` é estável e não deve ser tocado.
Toda extensão de comportamento do pipeline usa o padrão interceptor em `_run_job()` de `interviews.py`.
Exceção única registrada: GSD-003 adicionou `niche` e `interview_name` como argumentos de `refine_transcription()` — mudança de 1 linha justificada porque os valores estão em escopo naquele ponto.

### RN-008 — Stages são rastreados via interceptor
Nenhuma lógica de rastreamento de etapas vai para `pipeline.py`.
O interceptor em `_run_job()` captura início, fim, erro e metadados de cada stage.

---

## Regras de UI

### RN-009 — Sem asChild em Button
shadcn 4.5 com `@base-ui/react` não tem prop `asChild`.
Para links com estilo de botão: usar `<Link className="...">` puro.

### RN-010 — Tailwind v4 sem tailwind.config.js
Customizações de tokens via `@theme inline {}` em `globals.css`.
Nenhum plugin, nenhum `tailwind.config.js`, nenhuma `theme.extend`.

### RN-011 — Rota de impressão oculta UI
Qualquer rota que contenha `/print` (detectada por `/\/print(?:$|\/)/.test(pathname)`) deve renderizar apenas o conteúdo, sem Sidebar, Header ou AmbientBackground.

---

## Regras de Processo (Agentes)

### RN-012 — 1 GSD = 1 branch = 1 PR
Nunca trabalhar direto na `main`.
Nunca misturar dois GSDs na mesma branch.

### RN-013 — Plano antes de código
Qualquer feature nova exige apresentar plano mínimo e aguardar "pode começar" do usuário.

### RN-014 — Validar antes de PR
Todo `.py` tocado: `py_compile`.
Se tocou `.tsx/.ts`: `npm run build`.
PR só após build limpo.

### RN-015 — data/config/ é gitignored
`data/config/models.json` (configuração de modelos do usuário) não vai para o repositório.
`backend/prompts/_backups/` e `backend/prompts/_defaults/` também são gitignored.
