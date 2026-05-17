# GSD-01 — Correções Prioritárias

> Trabalhar 1 GSD por vez. Não avançar sem autorização.
> Fase de Correções (GSD-001 a GSD-008) concluída! Fase 5 liberada.

---

## GSD-001 — Corrigir Player de Mídia

**Status:** ✅ Concluído (2026-05-01) — testado com entrevista real `eventos/higor-santanna-meta-eventos`.

**Objetivo:** Player de áudio/vídeo deve mostrar duração correta e tocar ao clicar em play.

**Problema:** Player aparece com controles visíveis mas mostra duração 0 e não toca.

**Causa raiz real:**
Starlette 0.36.3 (`FileResponse`) **não implementa Range requests** — confirmado via
grep em `site-packages/starlette/responses.py` (zero ocorrências de `Accept-Ranges` /
`Content-Range`). O browser sempre envia `Range: bytes=0-` para ler o header codec
(RIFF/MP3 ID3) e calcular a duração. Sem resposta 206, o browser não consegue determinar
o tamanho total → duração = 0 e play bloqueado.

Causas secundárias também corrigidas:
- CORS sem `expose_headers` → browser bloqueava leitura de `Content-Range` cross-origin
- `FileResponse(filename=...)` → `Content-Disposition: attachment` → browser tentava baixar

**Fix aplicado em `backend/api/main.py`:**
```python
# ── Gerador de chunks para Range requests ──────────────────────────────────
def _file_range_generator(path: str, start: int, end: int, chunk: int = 65536):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data

# ── serve_media() — lógica de resposta ─────────────────────────────────────
# Sem Range → FileResponse + Accept-Ranges: bytes (anuncia suporte ao browser)
if not range_header:
    return FileResponse(
        path=str(found),
        media_type=media_type,
        content_disposition_type="inline",
        headers={"Accept-Ranges": "bytes"},
    )

# Com Range → 206 Partial Content
return StreamingResponse(
    _file_range_generator(str(found), start, end),
    status_code=206,
    media_type=media_type,
    headers={
        "Content-Range":  f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges":  "bytes",
        "Content-Length": str(chunk_length),
        "Content-Disposition": "inline",
    },
)

# CORSMiddleware (causas secundárias)
expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"]
```

**Arquivos alterados:** `backend/api/main.py` (único arquivo tocado)

**Escopo — não fazer:**
- Não modificar `pipeline.py`
- Não alterar `MediaPlayer.tsx` (já tem `key={src}` e `preload="metadata"`)
- Não alterar `mediaUrl()` em `api.ts` (já inclui `?token=`)

**Critério de pronto:**
- [x] DevTools → Network: request `/media/...` retorna **206 Partial Content**
- [x] Header `Content-Range` visível na resposta
- [x] Player mostra duração real (testado: WAV 71 MB e MP3 26 MB)
- [x] Botão play funciona
- [x] Seek (arrastar barra) funciona

**Como testar:**
```powershell
# 206 com Content-Range correto:
$req = [System.Net.HttpWebRequest]::Create("http://localhost:8000/media/{niche}/{interview}/{file}?token=<secret>")
$req.AddRange("bytes", 0, 1023)
$resp = $req.GetResponse()
$resp.StatusCode          # deve ser PartialContent (206)
$resp.Headers["Content-Range"]  # ex: bytes 0-1023/74506240
```

---

## GSD-002 — Adicionar Metadata de Entrevista

**Status:** ✅ Concluído (2026-05-01)

**Objetivo:** Permitir registrar título, entrevistado, entrevistador, telefone, e-mail e data ao criar ou editar uma entrevista.

**Problema:** Não há como identificar quem foi entrevistado, quem entrevistou, ou quando foi a entrevista. O único identificador é o nome do arquivo.

**Escopo:**
- Criar `metadata.json` por entrevista na raiz do diretório da entrevista
- `metadata.json` é salvo **de forma síncrona no upload**, antes de iniciar o pipeline
- Endpoints: `GET /interviews/{niche}/{interview}/meta` e `PUT /interviews/{niche}/{interview}/meta`
- Formulário de metadata no upload e editável na página da entrevista
- Entrevistador: texto livre por ora (campo preparado para Supabase com `interviewer_user_id`)
- Metadata usada pelo GSD-003 (refine com nomes reais de participantes)

**Não fazer:**
- Não modificar `pipeline.py`
- Não criar banco de dados — usar `metadata.json` no filesystem
- Não bloquear upload se metadata não preenchida (todos os campos são opcionais)

**Schema real de `metadata.json`:**
```json
{
  "title": "",
  "niche": "",
  "interview_slug": "",
  "interviewee_name": "",
  "interviewee_phone": "",
  "interviewee_email": "",
  "interviewer_name": "",
  "interviewer_user_id": "",
  "notes": "",
  "created_at": "2026-05-01T00:00:00+00:00",
  "source_filename": "",
  "updated_at": ""
}
```

> `interviewer_user_id` reservado para integração futura Supabase Auth (BL-007).
> `updated_at` adicionado automaticamente pelo endpoint PUT.

**Arquivos implementados:**
- `backend/storage/filesystem.py` — `read_meta()`, `write_meta()`, `META_FILENAME = "metadata.json"`
- `backend/api/routes/interviews.py` — `InterviewMetaUpdate` Pydantic model + 2 endpoints + upload atualizado
- `frontend-next/src/lib/api.ts` — tipo `InterviewMeta`, `UploadMetadata`, `getInterviewMeta()`, `updateInterviewMeta()`
- `frontend-next/src/components/interview/InterviewMeta.tsx` — painel compacto + form de edição
- `frontend-next/src/app/(app)/upload/page.tsx` — card "Participantes" com 4 campos opcionais
- `frontend-next/src/app/(app)/nicho/[nicho]/[entrevista]/page.tsx` — `<InterviewMeta>` entre timeline e viewer

**Critério de pronto:**
- [x] Formulário de metadata no upload e editável na página da entrevista
- [x] Salvar → recarregar → dados persistidos em `metadata.json`
- [x] `metadata.json` criado ANTES do pipeline iniciar (mesmo se pipeline falhar)
- [x] Entrevistas antigas sem `metadata.json` retornam `{}` no GET (sem 404)
- [x] Telefone e e-mail são opcionais (sem validação bloqueante)

**Como testar:**
1. `/upload` → preencher Participantes → iniciar pipeline
2. Verificar `data/niches/{nicho}/{entrevista}/metadata.json` criado imediatamente
3. Abrir a entrevista → strip mostra entrevistado + entrevistador
4. Clicar "Editar" → alterar campos → "Salvar" → recarregar → dados persistidos
5. Verificar que entrevistas antigas (sem `metadata.json`) não quebram

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
- Se `metadata.json` disponível → usar nome real do entrevistado/entrevistador
- Corrigir apenas erros óbvios de Whisper (palavras homófonas, pontuação)

**Estratégia — investigar antes de prescrever:**

> ⚠️ **Ler `pipeline.py` primeiro antes de qualquer código.**
> A estratégia correta depende de onde o prompt de refine está e como é chamado.
> Preferir alterar o menor número de arquivos possível.

1. **Investigar:** ler `backend/core/pipeline.py` e identificar onde o prompt de refine é definido e onde `call_llm()` / `call_with_model()` é chamado para o refine
2. **Decidir a abordagem mínima:**
   - Se o prompt está em variável editável no pipeline → externalizar para `backend/prompts/refine.md` e ajustar a leitura no menor ponto possível
   - Só criar `backend/services/refine_service.py` se não houver forma menos invasiva de injetar os metadados e o novo prompt
   - Só interceptar em `interviews.py` se for a única forma de passar `metadata.json` ao refine
3. **Não criar arquivos sem necessidade** — cada arquivo novo é manutenção futura

**Arquivos a investigar (ler antes de editar):**
- `backend/core/pipeline.py` — **ler apenas** primeiro: identificar onde o refine acontece
- `backend/prompts/refine.md` — criar (prompt novo)
- `backend/storage/filesystem.py` — `read_meta()` já disponível (GSD-002)
- `backend/api/routes/interviews.py` — interceptar se necessário (padrão já estabelecido)
- `backend/services/refine_service.py` — **criar somente se necessário**

**Não fazer:**
- Não modificar `pipeline.py` sem investigação prévia e autorização explícita
- Não criar `refine_service.py` antes de verificar se a abordagem mais simples resolve
- Não remover a etapa refine do pipeline
- Não mudar nome dos arquivos de output (`02_transcricao_refinada.md`)

**Critério de pronto:**
- [ ] Refine de nova entrevista produz texto com `**Entrevistador:**` e `**Entrevistado:**`
- [ ] Se `metadata.json` existir, nome real aparece em vez de "Entrevistado"
- [ ] Entrevistas antigas não são afetadas (só novas passam pelo novo prompt)
- [ ] Nenhuma fala inventada ou omitida

**Como testar:**
1. Fazer upload de uma entrevista de teste
2. Aguardar o step de refine concluir
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

**Status:** ✅ Concluído (via PR #5)

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

**Status:** ✅ Concluído (via PR #6)

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
