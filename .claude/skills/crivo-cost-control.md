# Skill: crivo-cost-control

## Objetivo
Operar o Crivo Insights com o menor custo possível de tokens, sem degradar qualidade.

## Quando usar
- Antes de qualquer sessão de trabalho (revisar regras)
- Custo de LLM está alto demais
- Sessão longa com muito contexto acumulado
- Refetch desnecessário de queries com LLM
- Auditoria de onde o projeto gasta tokens

---

## Regras de Custo da Sessão (invioláveis)

1. **Modelo padrão: Sonnet 4.6 Médio** (ou o modelo ativo configurado na sessão). Nunca escalar sem necessidade.
2. **Opus apenas com autorização explícita** — "pode usar Opus" ou "use claude-opus-*".
3. **Executar 1 bloco GSD por vez.** Terminar, entregar relatório, parar.
4. **Parar ao final do bloco** — não antecipar o próximo bloco sem pedido.
5. **Evitar prompts gigantes** — não incluir arquivos inteiros no contexto quando Read pontual resolve.
6. **Evitar reescrever arquivos completos** — usar Edit cirúrgico sempre que possível. Write completo só para arquivos novos ou reescritas necessárias.
7. **Não pedir build desnecessário** — `npm run build` só quando `.tsx/.ts` foi alterado.
8. **Sem polling manual** — nunca adicionar `sleep` em loops; usar `refetchInterval` no React Query.

---

## Mapa de Custo por Funcionalidade do Produto

| Funcionalidade | Modelo usado | Input estimado | Quando dispara |
|----------------|-------------|---------------|----------------|
| Refine | Sonnet 4.6 (padrão) | ~5–8k tokens | Manual, por entrevista |
| Structure | Sonnet 4.6 (padrão) | ~6–10k tokens | Manual, por entrevista |
| Glossary | Configurável (Haiku OK) | ~5–7k tokens | Manual, por entrevista |
| **Análise de nicho** | **Sonnet 4.6 fixo** | **~15–40k tokens** | **Manual, N entrevistas** |
| Consolidação glossário | Configurável | ~8k tokens | Manual |
| Consolidação insights | Configurável | ~10k tokens | Manual |

---

## Otimizações Já Implementadas no Produto

- [x] Análise de nicho: seleção manual de entrevistas (não analisa tudo automaticamente)
- [x] Input restrito a `03_entrevista_estruturada.md` (não a transcrição bruta)
- [x] Polling para imediatamente em `done`/`error`
- [x] `staleTime: 30_000` evita refetch da análise pronta
- [x] `retry: false` no query da análise (não reprocessa em 404)
- [x] CORS `expose_headers` corrigido (sem requests desnecessários de range)

---

## Otimizações Pendentes (ver GSD)

- [ ] Configuração de modelo por etapa via UI (GSD-004) — permitir Haiku para glossary
- [ ] Configuração de prompts via UI (GSD-005) — evitar prompts muito longos
- [ ] Seleção on-demand para análise de nicho (GSD-008) — menos tokens por não pré-carregar

---

## Práticas de Custo por Tipo de Tarefa

### Debug (crivo-debug)
- Ler apenas os arquivos mencionados no erro — não abrir tudo
- `py_compile` é grátis — usar liberalmente
- `npm run build` só quando necessário

### Feature nova (crivo-feature)
- Propor plano em texto antes de codar — texto é muito mais barato que código gerado errado
- Implementar backend → validar → frontend → validar — parar se der erro em vez de continuar
- Não gerar arquivos de teste automaticamente (não solicitado)

### UI Polish (crivo-ui-polish)
- Alterar tokens CSS é barato (1 arquivo, poucos tokens)
- Evitar reescrever componentes inteiros por ajuste cosmético
- Usar Edit cirúrgico nas linhas do CSS que precisam mudar

### Prompt config (crivo-prompt-config)
- Prompts `.md` em `backend/prompts/` são lidos em runtime — não reinicia servidor
- Editar prompt é operação de custo zero no produto
- Testar com 1 entrevista antes de processar o nicho inteiro

---

## Como Auditar Consumo

### OpenRouter Dashboard
- Acesse: `https://openrouter.ai/activity`
- Filtrar por modelo `anthropic/claude-sonnet-4-6`
- Ver tokens por request e custo total do dia/semana

### No Backend
```python
# Em niche_analyzer.py — se a resposta incluir usage:
# response.usage.input_tokens / output_tokens
# Logar em _jobs[job_id]["log"] para auditoria
```

---

## Referência de Custos Aproximados (OpenRouter, 2026)

| Modelo | Input / 1M tokens | Output / 1M tokens |
|--------|-------------------|---------------------|
| Sonnet 4.6 | ~$3 | ~$15 |
| Haiku 3.5 | ~$0.80 | ~$4 |
| Opus 4 | ~$15 | ~$75 |

**Análise de nicho com 5 entrevistas de 30min:** ~25k tokens input = ~$0,075.
**Análise de nicho com 15 entrevistas:** ~75k tokens = ~$0,22.

---

## O que NÃO fazer

- Não trocar modelo da análise de nicho para Haiku (perde qualidade crítica)
- Não adicionar `refetchOnWindowFocus: true` em queries de análise
- Não disparar análise automática em background
- Não usar Opus sem autorização explícita do usuário
- Não incluir `01_transcricao_bruta.md` no contexto da análise (só `03_estruturada.md`)
