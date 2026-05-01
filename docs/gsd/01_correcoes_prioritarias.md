# GSD-01 — Correções Prioritárias

> Trabalhar 1 GSD por vez. Não avançar sem autorização.
> Fase 5 (features novas) está pausada até GSD-008 estar concluído.

---

## GSD-001 — Corrigir Player de Mídia

**Status:** ✅ Concluído (2026-05-01) — testado com entrevista real `eventos/higor-santanna-meta-eventos`.

**Objetivo:** Player de áudio/vídeo deve mostrar duração correta e tocar ao clicar em play.

**Problema:** Player aparece com controles visíveis mas mostra duração 0 e não toca.

**Causas identificadas:**
1. CORS sem `expose_headers` → browser não lê `Content-Range` cross-origin → duração = 0
2. `FileResponse(filename=...)` → `Content-Disposition: attachment` → browser tenta baixar

**Fix aplicado em `backend/api/main.py`:**
```python
# CORSMiddleware
expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"]

# FileResponse
content_disposition_type="inline"  # removido filename=filename
```

**Arquivos alterados:** `backend/api/main.py`

**Escopo — não fazer:**
- Não modificar `pipeline.py`
- Não alterar `MediaPlayer.tsx` (já tem `key={src}` e `preload="metadata"`)
- Não alterar `mediaUrl()` em `api.ts` (já inclui `?token=`)

**Critério de pronto:**
- [ ] Player mostra duração real (ex: `3:24`)
- [ ] Botão play funciona
- [ ] Seek (arrastar barra) funciona
- [ ] DevTools → Network: request `/media/...` retorna **206 Partial Content**
- [ ] Header `Content-Range` visível na resposta

**Como testar:**
1. Reiniciar o backend (CORS só carrega no boot)
2. Abrir uma entrevista com arquivo em `raw/` ou `processed/`
3. Clicar no arquivo de áudio no FileExplorer
4. Verificar duração e play
5. Para vídeo: verificar seek arrastando a barra de progresso

---

## GSD-002 — Adicionar Metadata de Entrevista

**Status:** ⬜ Pendente

**Objetivo:** Permitir registrar título, entrevistado, entrevistador, telefone, e-mail e data ao criar ou editar uma entrevista.

**Problema:** Não há como identificar quem foi entrevistado, quem entrevistou, ou quando foi a entrevista. O único identificador é o nome do arquivo.

**Escopo:**
- Criar `meta.json` por entrevista (arquivo de metadados)
- Endpoints: `GET /interviews/{niche}/{interview}/meta` e `PUT /interviews/{niche}/{interview}/meta`
- Formulário de metadata na tela da entrevista (ou no upload)
- Entrevistador via lista suspensa (lista estática de nomes do sistema, por ora)
- Metadata usada pelo GSD-003 (refine com participantes)

**Não fazer:**
- Não modificar `pipeline.py`
- Não criar banco de dados — usar `meta.json` no filesystem
- Não bloquear upload se metadata não preenchida (opcional)

**Campos do `meta.json`:**
```json
{
  "titulo": "",
  "entrevistado": "",
  "cargo": "",
  "empresa": "",
  "telefone": "",
  "email": "",
  "entrevistador": "",
  "data": "",
  "notas": ""
}
```

**Arquivos prováveis:**
- `backend/storage/filesystem.py` — `read_meta()`, `write_meta()`, `interview_path()`
- `backend/api/routes/interviews.py` — 2 endpoints novos (GET + PUT)
- `frontend-next/src/lib/api.ts` — tipo `InterviewMeta`, `getInterviewMeta()`, `updateInterviewMeta()`
- `frontend-next/src/components/interview/InterviewMeta.tsx` — form novo (criar)
- `frontend-next/src/app/(app)/nicho/[nicho]/[entrevista]/page.tsx` — integrar form

**Critério de pronto:**
- [ ] Formulário de metadata acessível na página da entrevista
- [ ] Salvar → recarregar → dados persistidos no `meta.json`
- [ ] Entrevistador é selecionado em lista suspensa
- [ ] Telefone e e-mail são opcionais (sem validação bloqueante)

**Como testar:**
1. Abrir entrevista → editar metadata → salvar
2. Recarregar a página → dados devem aparecer preenchidos
3. Verificar que `meta.json` foi criado em `data/niches/{nicho}/{entrevista}/meta.json`

---

## GSD-003 — Atualizar Refine para Separar Participantes

**Status:** ⬜ Pendente (depende de GSD-002 para injetar nomes reais)

**Objetivo:** A etapa de refine deve formatar a transcrição como diálogo identificado por falante.

**Problema:** Refine atual produz texto corrido sem distinguir entrevistador de entrevistado, dificultando análise qualitativa.

**Output esperado:**
```markdown
**Entrevistador:** Qual é o maior desafio que você enfrenta hoje?

**Entrevistado:** Sem dúvida é a captação de clientes qualificados...

**Falante não identificado:** [trecho inaudível]
```

**Regras do prompt:**
- Nunca inventar falas — preservar conteúdo integral
- Se não identificar o falante → "Falante não identificado"
- Se `meta.json` disponível → usar nome real do entrevistado/entrevistador
- Corrigir apenas erros óbvios de Whisper (palavras homófonas, pontuação)

**Estratégia — sem modificar `pipeline.py`:**
1. Criar `backend/prompts/refine.md` com prompt novo
2. Criar `backend/services/refine_service.py` que lê meta + prompt e chama `call_with_model()`
3. Em `interviews.py`, interceptar o step de refine para usar o novo service

**Arquivos prováveis:**
- `backend/prompts/refine.md` — criar
- `backend/services/refine_service.py` — criar
- `backend/api/routes/interviews.py` — interceptar step refine
- `backend/services/pipeline.py` — **ler apenas** (identificar onde o refine é executado)
- `backend/storage/filesystem.py` — `read_meta()` (GSD-002)

**Não fazer:**
- Não modificar `pipeline.py`
- Não remover a etapa refine do pipeline
- Não mudar nome dos arquivos de output (`02_transcricao_refinada.md`)

**Critério de pronto:**
- [ ] Refine de nova entrevista produz texto com `**Entrevistador:**` e `**Entrevistado:**`
- [ ] Se meta.json existir, nome real aparece em vez de "Entrevistado"
- [ ] Entrevistas antigas não são afetadas (só novas passam pelo novo prompt)
- [ ] Nenhuma fala inventada ou omitida

**Como testar:**
1. Fazer upload de uma entrevista de teste
2. Executar apenas o step de refine
3. Abrir `02_transcricao_refinada.md` e verificar formato de diálogo

---

## GSD-004 — Criar Configurações de Modelos via UI

**Status:** ⬜ Pendente

**Objetivo:** Tela de configurações com dropdown para selecionar o modelo LLM de cada etapa do pipeline.

**Problema:** Trocar modelo requer editar `.env` e ter acesso ao servidor. Usuário não técnico não consegue configurar.

**Modelos padrão obrigatórios:**
- refine: `anthropic/claude-sonnet-4-6`
- structure: `anthropic/claude-sonnet-4-6`
- niche_analysis: `anthropic/claude-sonnet-4-6` — **nunca configurável na UI**
- glossary: configurável (Haiku é suficiente)
- consolidate_glossary: configurável

**Arquivos prováveis:**
- `backend/api/routes/` — novo arquivo `config.py` com `GET /config/models` e `PUT /config/models`
- `backend/core/config.py` — verificar se já suporta override por tarefa
- `backend/services/llm_client.py` — `_resolve_model()` pode ler de config persistido
- `frontend-next/src/app/(app)/settings/page.tsx` — nova seção "Modelos LLM"
- `frontend-next/src/lib/api.ts` — `getModelConfig()`, `updateModelConfig()`

**Não fazer:**
- Não expor niche_analysis como configurável na UI
- Não exibir Opus nas opções (custo proibitivo)
- Não reiniciar servidor para aplicar mudança de modelo

**Critério de pronto:**
- [ ] Dropdown por etapa na tela de configurações
- [ ] Alterar modelo → upload → confirmar no stage do timeline qual modelo foi usado
- [ ] Config persiste após reiniciar o browser

**Como testar:**
1. Acessar `/settings` → seção Modelos
2. Trocar glossary para Haiku → salvar
3. Processar entrevista → abrir timeline → ver "claude-3-haiku" no stage glossary

---

## GSD-005 — Criar Configurações de Prompts Editáveis

**Status:** ⬜ Pendente (depende de GSD-004 para ter a tela de configurações)

**Objetivo:** Tela de configurações com textarea para editar o conteúdo de cada prompt.

**Problema:** Ajustar um prompt requer acesso ao servidor e reinicialização. Prompts de refine/structure/glossary estão hardcoded em `pipeline.py`.

**Prompts editáveis (em ordem de prioridade):**
1. `refine` — mais impacto na qualidade
2. `structure` — define formato da entrevista estruturada
3. `niche_analysis` — já em `backend/prompts/niche_analysis.md`
4. `glossary` — termos e definições por entrevista
5. `consolidate_glossary` — glossário do nicho

**Arquivos prováveis:**
- `backend/prompts/` — criar arquivos `.md` para cada etapa ainda não externalizada
- `backend/api/routes/config.py` — `GET /config/prompts/{stage}` e `PUT /config/prompts/{stage}`
- `frontend-next/src/app/(app)/settings/page.tsx` — nova seção "Prompts"
- `frontend-next/src/lib/api.ts` — funções get/update prompt

**Não fazer:**
- Não permitir código arbitrário nos prompts (só texto)
- Não reiniciar servidor para aplicar mudança de prompt
- Não remover os defaults dos arquivos `.md` (sempre manter backup)

**Critério de pronto:**
- [ ] Textarea por etapa mostrando conteúdo atual
- [ ] Botão "Restaurar padrão" funciona
- [ ] Editar → salvar → processar entrevista → output reflete novo prompt
- [ ] Prompts são lidos em runtime (sem reiniciar servidor)

**Como testar:**
1. Acessar `/settings` → seção Prompts
2. Editar prompt de refine (adicionar instrução teste)
3. Processar entrevista → verificar que a instrução foi seguida no output

---

## GSD-006 — Ajustar Glossário

**Status:** ⬜ Pendente

**Objetivo:**
1. Glossário do nicho com mesmo nível de detalhe do glossário da entrevista (definição + exemplo + relacionados)
2. Permitir edição do markdown do glossário (libertar `_EDITABLE_DOCS`)
3. Remover `GlossaryPanel` da sidebar da página de entrevista (simplificar)

**Problema:**
- Glossário do nicho é uma concatenação simples — sem estrutura, com duplicatas
- Glossário da entrevista não pode ser editado manualmente
- `GlossaryPanel` na sidebar da entrevista cria ambiguidade com o glossário do nicho

**Escopo:**
- **Edição do glossário:** adicionar `"glossary"` ao `_EDITABLE_DOCS` no backend
- **Melhorar prompt de consolidação:** criar `backend/prompts/consolidate_glossary.md` com instrução de deduplicar e adicionar exemplo + relacionados
- **Remover sidebar de glossário:** retirar `GlossaryPanel` da página da entrevista (manter link "Ver glossário completo")

**Arquivos prováveis:**
- `backend/api/routes/interviews.py` — `_EDITABLE_DOCS` (adicionar `"glossary"`)
- `backend/services/consolidator.py` — melhorar prompt de consolidação
- `backend/prompts/consolidate_glossary.md` — criar
- `frontend-next/src/lib/api.ts` — `EditableDocType` (incluir `"glossary"`)
- `frontend-next/src/lib/files.ts` — `FILENAME_TO_DOC` (confirmar `glossario_local.md`)
- `frontend-next/src/app/(app)/nicho/[nicho]/[entrevista]/page.tsx` — remover GlossaryPanel

**Não fazer:**
- Não remover a rota `/glossario` e `/glossario/print`
- Não alterar `parseGlossaryMarkdown()` sem garantir compatibilidade com o formato existente
- Não apagar glossários existentes

**Critério de pronto:**
- [ ] Clicar em `glossario_local.md` no FileExplorer → modo edição disponível
- [ ] Glossário do nicho tem definição + exemplo + relacionados (após regenerar)
- [ ] Página de entrevista sem `GlossaryPanel` na sidebar — link para `/glossario` em seu lugar

**Como testar:**
1. Abrir entrevista → FileExplorer → clicar em `glossario_local.md` → botão "Editar" deve aparecer
2. Regenerar glossário de nicho → acessar `/nicho/{nicho}/glossario` → verificar estrutura
3. Verificar que sidebar da entrevista não tem mais painel de glossário

---

## GSD-007 — Ajustar Tema, Fundo e Light Mode

**Status:** ⬜ Pendente

**Objetivo:**
1. Corrigir light mode com cores estranhas e baixo contraste
2. Redistribuir blobs para cobrir a tela (não apenas o centro)
3. Tornar animação visível (duração maior)
4. Adicionar opção de desativar animação ou escolher visual "simples"

**Problema:**
- Tema claro tem fundo com tom estranho e contraste insuficiente
- Blobs aparecem todos concentrados no centro
- Animação de 22s/26s/30s é imperceptível em movimento lento
- Sem opção de desativar para usuários sensíveis a movimento

**Escopo:**
- Revisar todos os tokens oklch do `:root` (tema claro) em `globals.css`
- Ajustar posição dos 3 blobs em `AmbientBackground.tsx` para cobrir cantos
- Aumentar duração das animações para 35s/42s/50s
- Adicionar toggle "Modo simples" (sem blobs) salvo em `localStorage: crivo:simple-mode`
- Adicionar opção nas configurações: "AI Glow" vs "Simples"
- Respeitar `prefers-reduced-motion` do sistema operacional

**Arquivos prováveis:**
- `frontend-next/src/app/globals.css` — tokens `:root` e `.dark`, keyframes
- `frontend-next/src/components/effects/AmbientBackground.tsx` — posição + toggle
- `frontend-next/src/components/theme/ThemeToggle.tsx` — toggle modo simples (opcional)
- `frontend-next/src/app/(app)/settings/page.tsx` — opção de visual

**Não fazer:**
- Não hardcodar cores hex
- Não usar `tailwind.config.js`
- Não alterar backend

**Critério de pronto:**
- [ ] Tema claro: texto com contraste ≥ 4.5:1 (verificar DevTools)
- [ ] Blobs visíveis nos cantos da tela, não apenas no centro
- [ ] Animação perceptível (movimento lento mas visível)
- [ ] Toggle "Modo simples" funciona e persiste entre reloads
- [ ] `prefers-reduced-motion: reduce` desativa blobs automaticamente

**Como testar:**
1. Alternar para tema claro → verificar legibilidade geral
2. DevTools → Elements → Inspect texto → verificar "Contrast ratio" ≥ 4.5
3. Verificar posição dos blobs em tela cheia (cantos vs centro)
4. Ativar "Modo simples" → recarregar → blobs não devem aparecer
5. DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → blobs some

---

## GSD-008 — Limpar Análise de Nicho

**Status:** ⬜ Pendente

**Objetivo:**
1. Seleção de entrevistas aparece SOMENTE ao clicar "Analisar nicho" (não poluir a UI)
2. Remover ou rebaixar "Consolidação de insights" (substituir pelo fluxo de análise)
3. Deixar clara a diferença entre dois fluxos: por entrevista vs por nicho

**Problema:**
- Seleção de entrevistas está sempre visível, poluindo a listagem
- "Consolidação de insights" e "Análise de nicho" são nomes ambíguos
- Usuário não entende qual fluxo usar para qual objetivo

**Fluxos que devem existir:**
1. **Extrair insights** (por entrevista) — ação na página da entrevista
2. **Analisar nicho** (múltiplas entrevistas) — ação na página do nicho, com seleção on-demand

**Escopo:**
- Seleção de entrevistas: aparece em modal ou painel ao clicar "Analisar nicho"
- Aba "Análise" substitui "Consolidação de insights" como ação principal
- Consolidação legada permanece mas rebaixada (ação secundária / oculta)
- Nomenclatura consistente: "Analisar nicho" em PT-BR, sem "consolidar"

**Arquivos prováveis:**
- `frontend-next/src/app/(app)/nicho/[nicho]/page.tsx` — principal (checkboxes, tabs, buttons)
- `frontend-next/src/components/niche/AnalyzeNicheButton.tsx`
- `frontend-next/src/components/niche/NicheAnalysisTab.tsx`

**Não fazer:**
- Não remover os endpoints de consolidação do backend (legado preservado)
- Não alterar `backend/api/routes/niches.py`
- Não remover polling ou invalidateQueries

**Critério de pronto:**
- [ ] Listagem de entrevistas na página do nicho não mostra checkboxes por padrão
- [ ] Clicar "Analisar nicho" → abre seletor de entrevistas (modal ou inline)
- [ ] Aba principal é "Análise" com texto descritivo claro
- [ ] "Consolidação" desaparece ou vira ação secundária discreta

**Como testar:**
1. Acessar `/nicho/{nicho}` → lista de entrevistas não deve ter checkboxes visíveis
2. Clicar "Analisar nicho" → seletor aparece
3. Selecionar entrevistas e iniciar → análise roda normalmente
4. Verificar que tab "Análise" está em destaque

---

## Extra — Logo / Favicon

**Status:** ⬜ Pendente (baixa prioridade)

**Objetivo:** Adicionar ícone do Crivo Insights como favicon e ícone de aba do browser.

**Escopo:**
- Criar `frontend-next/public/favicon.ico` e `favicon.svg`
- Atualizar `frontend-next/src/app/layout.tsx` com `<link rel="icon">`
- Ícone: conceito "crivo" (peneira/filtro) em azul + roxo, estilo minimalista

**Arquivos prováveis:**
- `frontend-next/public/favicon.ico`
- `frontend-next/public/favicon.svg`
- `frontend-next/src/app/layout.tsx`
