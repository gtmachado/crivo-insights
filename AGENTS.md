# AGENTS.md — Protocolo de Handoff Multiagente

> **Leia este arquivo antes de qualquer ação.**
> Aplica-se a: Claude Code, Antigravity, Codex/GPT e qualquer outro agente.

---

## Por que este arquivo existe

O objetivo **não é dividir papéis fixos entre agentes**.
O objetivo é permitir **rodízio e fallback seguros** quando um agente atingir limite de tokens, créditos ou contexto.

Qualquer agente deve conseguir assumir o projeto do ponto onde outro parou — sem causar regressões, duplicações ou inconsistências de arquitetura.

**A fonte da verdade não é a memória do chat.**
**A fonte da verdade é o repositório + documentação do projeto.**

---

## Hierarquia de fontes de verdade

Em caso de divergência, prioridade:

1. **Código real no repositório** — o que está em disco é a realidade
2. **Documentação do projeto** (`CLAUDE.md`, `docs/`, `AGENTS.md`)
3. **Mensagens recentes do usuário** no chat
4. **Memória do agente** — a menos confiável; pode estar desatualizada ou alucinada

---

## Leitura obrigatória ao iniciar sessão

Todo agente, antes de qualquer ação, **deve ler**:

1. `AGENTS.md` — este arquivo
2. `CLAUDE.md` — constituição técnica do projeto (regras invioláveis)
3. `docs/handoff/CURRENT_TASK.md` — tarefa atual, branch, próximo passo
4. `docs/handoff/LAST_SESSION.md` — o que foi feito na sessão anterior
5. `docs/gsd/00_estado_atual.md` — estado geral do produto
6. `docs/gsd/01_correcoes_prioritarias.md` — GSD em andamento

---

## Fluxo ao iniciar sessão

1. **Declare quem é:** nome do agente e versão (ex: "Claude Code, Sonnet 4.6")
2. **Leia os 6 arquivos obrigatórios** acima
3. **Confirme** para o usuário:
   - tarefa atual (GSD e subfase)
   - branch de trabalho
   - arquivos principais envolvidos
   - próximo passo concreto
   - riscos identificados
4. **Feature nova:** apresente o plano e aguarde aprovação. Aprovado o plano, siga as etapas sem pedir "pode começar" a cada uma (Trilho auditável do `CLAUDE.md`)

---

## Fluxo ao encerrar sessão

Antes de encerrar, **atualize obrigatoriamente**:

1. `docs/handoff/CURRENT_TASK.md` — estado atual da tarefa
2. `docs/handoff/LAST_SESSION.md` — o que foi feito nesta sessão
3. `docs/handoff/AGENT_LOG.md` — adicionar linha na tabela de log

---

## Regras de trabalho

| Regra | Descrição |
|---|---|
| 1 mudança = 1 branch = 1 PR | Nunca trabalhar direto na `main` |
| Não avançar escopo | Executar apenas o plano aprovado |
| Plano antes de feature nova | Propor e aguardar aprovação; depois seguir as etapas |
| Trilho auditável | Gates verdes + commit + entrada em `docs/refactor/LOG.md` por etapa |
| Menor patch possível | Edit cirúrgico; Write completo só para arquivos novos |
| Nunca modificar `backend/core/pipeline.py` | Usar o interceptor em `services/interview_runner.py` |
| Sonnet 4.6 fixo em `niche_analysis` | `call_with_model()`; nunca `resolve_model()` lá |
| Backend: `py_compile` + `pytest` | Verdes antes de entregar |
| Frontend: `lint` + `tsc --noEmit` + `build` | 0 problemas antes de PR |
| Cores só por token | Nada de `emerald-*`, hex ou rgb (ver `crivo-ui-polish.md`) |
| Sem Opus sem autorização | Custo proibitivo |
| Docs vencem memória | Sempre reler docs antes de agir |

---

## Prompt padrão de handoff entre agentes

Ao passar o projeto para outro agente, use exatamente este prompt:

```
Você está assumindo o projeto Crivo Insights.

Antes de agir, leia nesta ordem:
1. AGENTS.md
2. CLAUDE.md
3. docs/handoff/CURRENT_TASK.md
4. docs/handoff/LAST_SESSION.md
5. docs/gsd/00_estado_atual.md
6. docs/gsd/01_correcoes_prioritarias.md

Confirme para mim:
- Qual é a tarefa atual (GSD e subfase)?
- Qual é a branch de trabalho?
- Quais arquivos estão envolvidos?
- Qual é o próximo passo concreto?
- Quais são os riscos identificados?

Não altere código antes de me mostrar o plano mínimo e eu aprovar.
```

---

## Skills disponíveis

| Arquivo | Quando usar |
|---|---|
| `.claude/skills/crivo-debug.md` | Bug, erro de build, player não toca, 500 no backend |
| `.claude/skills/crivo-feature.md` | Feature nova |
| `.claude/skills/crivo-ui-polish.md` | Ajuste visual, tema, tokens, componentes |
| `.claude/skills/crivo-prompt-config.md` | Editar prompt ou modelo LLM |
| `.claude/skills/crivo-cost-control.md` | Controle de custo, auditoria de tokens |

---

## Observação sobre o frontend-next/AGENTS.md

O arquivo `frontend-next/AGENTS.md` contém avisos sobre o Next.js 16 (APIs com breaking changes).
Ele é referenciado por `frontend-next/CLAUDE.md` para alertar agentes sobre convenções do framework.
É um arquivo técnico distinto deste — **não substituí-lo**.
