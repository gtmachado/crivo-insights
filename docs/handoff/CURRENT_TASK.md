# CURRENT_TASK.md

> Atualizado em: 2026-10-17
> Agente executor da última sessão: Claude Code (Opus 5.5 no planejamento e na E0; Sonnet 5.5 da E1 em diante)

---

## Estado atual

| Campo | Valor |
|---|---|
| **Tarefa anterior** | Refatoração + facelift "Caderno de Campo" ✅ Concluída (etapas E0–E8) |
| **Fase produto** | Fase de Correções concluída (GSD-001 a GSD-008); Fase 5 liberada |
| **Branch** | `refactor/facelift` (PR aberto para `main`) |
| **Tag de rollback** | `pre-facelift` (`a247fca`) |
| **Registro** | `docs/refactor/LOG.md` — o quê / por quê / arquivos / evidência dos gates / riscos, por etapa |
| **Gates na entrega** | pytest 91 passed · lint 0 problemas · tsc 0 erros · build OK (9 páginas) |

---

## Próxima tarefa de produto

Não há tarefa ativa. Candidatas (backlog em `docs/gsd/02_backlog.md`):

- **BL-001/002** — histórico de análises de nicho e exportar a análise em PDF
- **BL-003** — busca global (Ctrl/Cmd+K)
- **BL-007** — multiusuário (o `interviewer_user_id` já está reservado)
- Trocar o SDK deprecado do Gemini (`google-generativeai`) e adicionar CI (GitHub Actions) com os gates acima
- Fixar o formato de saída do prompt do glossário (hoje o parser tolera os 3 formatos que o LLM produz)

## Pendências conhecidas da entrega

- O **login real do Supabase não foi exercitado** na QA (usou-se sessão simulada em `localStorage`).
- `/glossario/print` dispara `window.print()` e **não foi aberta** na QA.
- O token continua indo na query de `/media` (limitação de `<audio>`/`<video>`).
- Whisper compartilhado entre threads sem lock; `_ffmpeg_available()` roda a cada uso.

## Como trabalhar daqui para frente

Trilho auditável (`CLAUDE.md`, seção 2): branch por mudança, etapas sequenciais, gates verdes, commit e entrada no log por
etapa; parar só nos gatilhos listados (tocar `core/pipeline.py`, dados reais, decisão de produto, gate travado).
