# Skill: crivo-prompt-config

## Objetivo
Editar prompts LLM e configurar modelos por etapa no Crivo Insights.

## Quando usar
- GSD-003: Atualizar prompt de refine para separar participantes
- GSD-004: Criar configurações de modelos via UI
- GSD-005: Criar configurações de prompts editáveis via UI
- Melhorar qualidade de output de qualquer etapa do pipeline
- Trocar modelo padrão de uma etapa

---

## Regras Obrigatórias

1. **Análise de nicho = sempre Sonnet 4.6.** Nunca adicionar override em `niche_analyzer.py`.
2. **Não modificar `pipeline.py`** para adicionar prompts — usar `backend/prompts/` e ler nos services.
3. **Sonnet 4.6 padrão obrigatório para:** refine, structure, niche_analysis.
4. **Glossary e consolidation** podem usar modelo mais barato — configurável.
5. **`py_compile`** nos services afetados antes de entregar.
6. **Ler o arquivo do prompt antes de editar** — nunca editar às cegas.

---

## Modelos Padrão Obrigatórios (GSD-004)

| Etapa | Modelo padrão | Override permitido? |
|-------|--------------|---------------------|
| refine | `anthropic/claude-sonnet-4-6` | Não recomendado |
| structure | `anthropic/claude-sonnet-4-6` | Não recomendado |
| niche_analysis | `anthropic/claude-sonnet-4-6` | **Nunca** |
| glossary | Configurável (pode ser Haiku) | Sim |
| consolidate_glossary | Configurável (pode ser Haiku) | Sim |
| insight por entrevista | `anthropic/claude-sonnet-4-6` | Configurável |

---

## Mapa de Prompts Atual

| Etapa | Localização atual | Status |
|-------|------------------|--------|
| refine | hardcoded em `pipeline.py` | ⚠️ Precisa extrair (GSD-003/005) |
| structure | hardcoded em `pipeline.py` | ⚠️ Precisa extrair (GSD-005) |
| glossary | hardcoded em `pipeline.py` | ⚠️ Precisa extrair (GSD-005) |
| niche_analysis | `backend/prompts/niche_analysis.md` | ✅ Já externalizado |
| consolidate_insights | em `consolidator.py` | ⚠️ Verificar |
| consolidate_glossary | em `consolidator.py` | ⚠️ Verificar |

---

## GSD-003 — Refine com Separação de Participantes

### O que mudar

O prompt de refine atual produz texto corrido. O novo deve formatar como diálogo:

```markdown
**Entrevistador:** [fala do entrevistador]

**Entrevistado:** [fala do entrevistado]

**Falante não identificado:** [fala de falante desconhecido]
```

### Regras do novo prompt
- Nunca inventar falas ou trocar de falante por dedução
- Se não conseguir identificar quem fala, usar "Falante não identificado"
- Se `metadata.json` disponível, usar nome real: `**João Silva (entrevistado):**`
- Preservar conteúdo integral — nenhuma fala omitida, apenas formatada
- Corrigir apenas erros de transcrição óbvios (Whisper confunde palavras semelhantes)

### Estratégia — investigar antes de prescrever

> ⚠️ **Ler `pipeline.py` primeiro.** A abordagem correta depende de como o refine está implementado.

1. **Investigar:** ler `backend/core/pipeline.py` — onde está o prompt de refine? Como é chamado?
2. **Preferir a solução mínima:**
   - Se o prompt é uma variável editável: externalizar para `backend/prompts/refine.md` com o menor patch possível
   - Injetar `metadata.json` no ponto mais próximo onde o prompt é construído
3. **Só criar `refine_service.py` se necessário** — wrapper separado somente quando não há forma menos invasiva
4. **Não modificar `pipeline.py`** sem investigação prévia e autorização explícita

`read_meta()` já está disponível em `filesystem.py` (implementado no GSD-002).

---

## GSD-004 — Configurações de Modelos via UI

### Objetivo
Criar área na tela `/settings` onde o usuário seleciona o modelo de cada etapa via dropdown.

### Persistência
Duas opções:
- **Simples:** `localStorage` no frontend + enviar `model` no body do upload
- **Persistente:** `GET /config` + `PUT /config` no backend, salvar em `config.json`

### Campos de configuração de modelo
```typescript
type ModelConfig = {
  refine: string;           // padrão: "anthropic/claude-sonnet-4-6"
  structure: string;        // padrão: "anthropic/claude-sonnet-4-6"
  glossary: string;         // padrão: "anthropic/claude-3-haiku" (mais barato)
  consolidate_glossary: string;
  insight_per_interview: string;
  // niche_analysis: não configurável — sempre Sonnet 4.6
};
```

### Modelos disponíveis para exibir no dropdown
```
anthropic/claude-sonnet-4-6  (recomendado — qualidade)
anthropic/claude-3-5-haiku   (rápido — mais barato)
anthropic/claude-3-opus-4    (não oferecer — custo muito alto)
```

---

## GSD-005 — Configurações de Prompts Editáveis via UI

### Objetivo
Criar área na tela `/settings` para editar o conteúdo de cada prompt em um `<textarea>`.

### Backend necessário
```python
# GET /config/prompts — retorna todos os prompts editáveis
# PUT /config/prompts/{stage} — salva o prompt de uma etapa
```

### Frontend
- `<textarea>` por etapa, mostrando conteúdo atual
- Botão "Restaurar padrão" por prompt (ler do arquivo original em `backend/prompts/`)
- Salvar via PUT — não reinicia o servidor (leitura em runtime)

### Prompts editáveis (em ordem de prioridade)
1. `refine` — mais impacto na qualidade da transcrição
2. `structure` — define o formato da entrevista estruturada
3. `niche_analysis` — já em `backend/prompts/niche_analysis.md`
4. `glossary` — termos e definições
5. `consolidate_glossary` — glossário do nicho
6. `insight_per_interview` — se existir

---

## Como Adicionar Nova Etapa com Prompt Próprio

1. Criar `backend/prompts/nome_etapa.md`
2. Criar service em `backend/services/nome_service.py`
3. Ler prompt: `Path(__file__).parent.parent / "prompts" / "nome_etapa.md"`
4. Usar `call_with_model(provider, model, system_prompt, user_content)` para modelo fixo
5. Ou `call_llm(task="nome_etapa", ...)` para respeitar `LLM_PROVIDER`

---

## Alterar Modelo do Pipeline via Env (método atual)

```bash
# .env no backend
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=anthropic/claude-3-haiku  # mais barato para glossary
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

O `_resolve_model(task)` em `llm_client.py` usa essas vars. **Não afeta `niche_analyzer.py`** (usa `call_with_model()` direto).

---

## Relatório de Fim de Bloco

Entregar:
1. **Prompt alterado** (nome do arquivo + o que mudou)
2. **Modelos configurados** (etapa → modelo)
3. **Como testar** (disparar etapa e verificar output)
4. **Build limpo** confirmado
