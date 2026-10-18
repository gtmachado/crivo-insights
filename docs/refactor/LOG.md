# Refatoração + Facelift "Caderno de Campo" — Log auditável

Branch: `refactor/facelift` · Rollback: tag local `pre-facelift` (`a247fca`)

## Estratégia ("Trilho auditável")

- Etapas sequenciais E0–E8, sem parada obrigatória entre elas.
- Cada etapa só fecha com gates verdes:
  - backend: `py_compile` + `pytest`;
  - frontend: `lint` + `tsc --noEmit` + `build`.
- Cada etapa fecha com commit(s) convencionais e uma entrada neste arquivo.
- Paradas obrigatórias (o agente para e pergunta):
  - tocar `backend/core/pipeline.py`;
  - tocar dados reais em `data/niches/`;
  - decisão de produto fora do plano;
  - gate travado após 3 tentativas.
- A verificação visual usa só dados existentes. Upload, transcrição e análise não são disparados, para não gastar créditos de LLM.

Formato de cada entrada: **O quê / Por quê / Arquivos / Evidência dos gates / Riscos e pendências**.

---

## E0 — Preparação

- **O quê:**
  - criada a branch `refactor/facelift` e a tag `pre-facelift`;
  - adicionada a config `backend` (uvicorn, Python 3.11) em `.claude/launch.json`;
  - lidos os guias do Next 16 sobre `useSearchParams` (exige `<Suspense>` em rotas pré-renderizadas) e sobre a convenção `app/icon.svg`.
- **Por quê:** criar um ponto de rollback e um ambiente de verificação reproduzível.
- **Arquivos:** `.claude/launch.json`, `docs/refactor/LOG.md`.
- **Evidência (baseline antes de qualquer mudança):** 
  - **`py_compile` (backend inteiro):** OK.
  - **`pytest`:** não instalado no Python 3.11.
  - **Versões locais:** fastapi 0.110.0, starlette 0.36.3, pydantic 2.13.3, pydantic-settings 2.14.0. Diferem de `requirements.txt`, que pede fastapi 0.115.
  - **`tsc --noEmit`:** exit 0.
  - **`npm run lint`:** **17 problemas (15 erros, 2 warnings) já existentes**, por exemplo `react-hooks/set-state-in-effect` em `ui/dialog.tsx:36`. Até a E6 o lint precisa terminar com 0 erros; nas etapas anteriores o critério é não aumentar a contagem.
  - **`npm run build`:** OK, 12 rotas.
- **Riscos e pendências:** o ambiente local tem versões diferentes das de `requirements.txt` (ver baseline).
