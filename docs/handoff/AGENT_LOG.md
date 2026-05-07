# AGENT_LOG.md

Histórico de sessões por GSD/subfase. Atualizar ao encerrar cada sessão.

---

| Data | Agente | GSD / Subfase | Branch | Arquivos principais | Resumo | Status |
|------|--------|--------------|--------|---------------------|--------|--------|
| 2026-04-xx | Claude Code | Fases 0–4 + GSD-001 | main (direto) | Múltiplos — ver commit `7cb9a9b` | Setup completo: UI visual, editor, player, pipeline timeline, glossário, análise de nicho. GSD-001 fix (Range requests no player de mídia) | ✅ Concluído |
| 2026-05-01 | Claude Code | GSD-002 — Metadata de entrevista | main (direto) | `filesystem.py`, `interviews.py`, `api.ts`, `InterviewMeta.tsx`, `upload/page.tsx` | `metadata.json` por entrevista; form no upload; exibição/edição na página da entrevista | ✅ Concluído — sem PR |
| 2026-05-02 | Claude Code | GSD-003 — Refine + modelos + Whisper | main (direto) | `refiner.py`, `refine_prompt.md`, `pipeline.py`, `llm_client.py`, `config.py`, `.env.example` | Refine com separação de participantes; Sonnet 4.6 como default LLM; Whisper medium como padrão | ✅ Concluído — sem PR |
| 2026-05-02 | Claude Code | GSD-004 — Modelos via UI | feat/gsd-004-modelos-ui | `config.py` (route), `ModelSettings.tsx`, `api.ts`, `filesystem.py`, `llm_client.py` | GET/PUT `/config/models`; dropdown por etapa; `data/config/models.json` | ✅ Concluído — PR #1 mergeado 2026-05-02 |
| 2026-05-02 | Claude Code | GSD-005 — Prompts via UI | feat/gsd-005-prompts-ui | `config.py` (route), `PromptSettings.tsx`, `textarea.tsx`, `api.ts` | GET/PUT/POST `/config/prompts`; editor de prompt com backup e restore | ✅ Concluído — PR #2 mergeado 2026-05-03 |
| 2026-05-03 | Claude Code | GSD-006 — Ajuste de glossário | feat/gsd-006-glossario | `interviews.py`, `consolidate_glossary_prompt.md`, `api.ts`, `page.tsx` (entrevista) | Glossário editável; sidebar removida; link "Ver glossário"; prompt de consolidação melhorado | ✅ Concluído — PR #3 mergeado 2026-05-03 |
| 2026-05-03 | Claude Code | Docs — Base multiagente | docs/multiagente-handoff | `AGENTS.md`, `docs/handoff/`, `docs/sdd/`, `docs/decisions/`, `docs/gsd/00_estado_atual.md` | Criação da infraestrutura de handoff multiagente: protocolo, SDDs, ADR, handoff docs | 🔄 Em andamento — PR pendente |

---

> **Como adicionar uma entrada:**
> Ao encerrar uma sessão, adicione uma linha nesta tabela com:
> - Data no formato AAAA-MM-DD
> - Nome + modelo do agente
> - GSD e subfase trabalhada
> - Branch usada
> - Arquivos principais tocados (máx 5)
> - Resumo em 1 linha
> - Status: ✅ Concluído / 🔄 Em andamento / ❌ Bloqueado / ⏸ Pausado
