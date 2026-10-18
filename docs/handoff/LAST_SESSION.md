# LAST_SESSION.md

> Sessão mais recente registrada em: 2026-10-17
> Agente executor: Claude Code (Opus 5.5 → Sonnet 5.5)

---

## O que foi feito nesta sessão

Pedido do usuário: refatorar, melhorar e dar um facelift completo ao projeto — visual **clean, moderno, claro por padrão,
sem cara de IA** — removendo todo o legado e com uma estratégia de execução **auditável e segura, mas autônoma**.

Foram feitas uma exploração (frontend, backend e docs), um plano aprovado e a execução em 9 etapas (E0–E8) na branch
`refactor/facelift`, cada uma com gates verdes, commit e entrada em `docs/refactor/LOG.md`.

| Etapa | Resultado |
|---|---|
| E0 | Branch, tag `pre-facelift`, baseline dos gates, config de preview do backend |
| E1 | Legado removido; auth em todas as rotas; correção de traversal, Range, upload, `PUT /meta`, corrida de job; 72 testes |
| E2 | `core/layout.py`, `interview_runner`, `jobs`, `prompt_store`, `model_config`, `llm_client` unificado, `response_model`, escrita atômica |
| E3 | `api.ts` tipado (`ApiError`), `query-keys`, limpeza de legado no frontend, regex de acentos do glossário |
| E4 | Design system: tokens claro/escuro, fontes locais, componentes shadcn (base-ui), `common/`, logo e favicon |
| E5 | Sidebar única, layout sem header, Sheet no mobile, login novo |
| E6 | Todas as páginas redesenhadas; hooks; lint zerado |
| E7 | QA em claro/escuro/mobile; parser de glossário tolerante; contraste AA; 401 sem token |
| E8 | Docs (README, CLAUDE.md, AGENTS.md, skills, GSD, handoff), push e PR |

## Pontos de atenção para quem assume

- **`backend/core/pipeline.py` não foi tocado** (e o teste `test_layout_continua_alinhado_com_os_literais_do_pipeline` o amarra a `core/layout.py`).
- A CLI do shadcn 4.5.0 reescreveu imports para um pacote npm `cn` (corrigido); confira imports/`package.json` após `shadcn add`.
- O ambiente local tem fastapi 0.110 / starlette 0.36, diferente do `requirements.txt` (0.115); os testes rodam nele.
- O tmp padrão do pytest não é gravável no ambiente do agente; `pytest.ini` usa `--basetemp=.pytest_tmp` (ignorado pelo git).

## Arquivos mais importantes tocados

`docs/refactor/LOG.md` (registro completo) · `backend/core/layout.py` · `backend/services/*` · `backend/api/*` ·
`frontend-next/src/app/globals.css` · `frontend-next/src/components/{common,layout,interview,niche,dashboard,settings,glossary}/*` ·
`frontend-next/src/lib/{api,query-keys,status,glossary}.ts` · `frontend-next/src/hooks/*`
