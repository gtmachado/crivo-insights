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

---

## E1 — Backend: legado, segurança, bugs e testes

- **O quê:**
  - **Legado removido:**
    - endpoints de consolidação (`consolidate/*`, `/niches/{n}/insights`, `/niches/{n}/glossary`);
    - `services/consolidator.py` e os prompts `consolidate*.md`;
    - o frontend Streamlit (`frontend/`, `run_frontend.*`);
    - o `test_pipeline.py` quebrado;
    - as tasks `consolidate*` em config, `llm_client` e `.env.example`;
    - `streamlit`, `ffmpeg-python`, `aiofiles`, `python-dotenv` e `httpx` saíram de `requirements.txt`.
  - **Segurança:**
    - `verify_token` vive em `api/auth.py` e usa `hmac.compare_digest`;
    - aplicado como dependência do router em **todas** as rotas, exceto `/health`; antes só o `/media` era protegido;
    - `/media` valida o caminho com `resolve()` + `is_relative_to` (path traversal);
    - suffix range (`bytes=-N`) corrigido e `416` com `Content-Range: bytes */N`;
    - upload sanitiza o nome, rejeita extensão não suportada **antes** de criar a entrevista e usa uma pasta tmp única por envio, limpa no fim;
    - o upload é `def`, não `async def`, então a cópia bloqueante deixa de travar o event loop.
  - **Bugs:**
    - `PUT /meta` agora aplica só os campos enviados (`exclude_unset=True`); antes um PUT parcial zerava os outros campos;
    - o job nasce **antes** da task (`JobStore.create`), então não há mais 404 no primeiro poll de status;
    - `GET /niches/{n}/analysis` não cria mais `_insights/` em nichos inexistentes, que poluíam `list_niches`;
    - o filtro de pastas privadas é o mesmo em todas as listagens;
    - o glossário é editável de forma coerente em docstring e mensagem.
  - **Novo:**
    - `services/jobs.py` com `JobStore` thread-safe: `mutate` sob lock, `get` devolve cópia e há limite de jobs finalizados. Isso adianta parte da E2;
    - `/media` virou `routes/media.py`;
    - `AnalyzeNicheRequest` usa `min_length=1`, então lista vazia devolve 422 no lugar do 400 antigo.
  - **Testes:** 72 testes em `backend/tests/`, todos com `data_dir` e prompts em diretórios temporários.
    - **Cobertura:**
      - auth (inclui `/media` e `/health`);
      - parse e serviço de Range;
      - path traversal;
      - ciclo de upload e job (sucesso e erro);
      - merge parcial do meta;
      - documentos;
      - listagens;
      - análise de nicho;
      - config de modelos e prompts;
      - contrato `_classify_stage` com as mensagens reais do `pipeline.py`.
    - **Configuração:** `pytest.ini` usa `--basetemp=.pytest_tmp` (o tmp padrão do pytest não é gravável no ambiente do agente); `requirements-dev.txt`.
- **Por quê:** fechar as brechas de segurança e os bugs de dados antes de reorganizar o código, com testes que travam o comportamento.
- **Arquivos:** `backend/api/{main,auth}.py`, `backend/api/routes/{interviews,niches,config,media}.py`, `backend/services/{jobs,llm_client,niche_analyzer}.py`, `backend/storage/filesystem.py`, `backend/core/config.py`, `requirements*.txt`, `pytest.ini`, `.env.example`, `backend/tests/*`.
- **Evidência dos gates:**
  - `py_compile` de todo o backend: OK;
  - `pytest`: **72 passed** (ambiente local fastapi 0.110.0 / starlette 0.36.3);
  - `backend/core/pipeline.py` **não** foi modificado (`git status`).
- **Riscos e pendências:**
  - **Frontend quebrado de propósito entre E1 e E3:** `api.ts` e a página do nicho ainda chamam os endpoints de consolidação removidos; a E3 limpa isso.
  - **Nichos antigos:** arquivos consolidados antigos em `data/niches/*/_insights` e `_glossary` ficam intactos no disco (nenhum dado foi tocado). A análise de nicho continua gravando em `_insights/analise_{slug}.md`.
  - **Sem proteção em dev:** com `API_SECRET_KEY` vazio a API continua sem proteção; isso é intencional para dev local.
  - **Pendências para a E2:** `llm_client` (provider e retry) e `prompt_store`.

---

## E2 — Backend: reorganização estrutural

- **O quê:** `core/pipeline.py` continua intocado (`git diff` vazio).
  - **Fonte única:**
    - `core/layout.py` concentra `DOCS` (nomes de arquivo), `LLM_TASKS`, o nome do meta e os modelos fixos da análise de nicho;
    - substitui as cópias que existiam em `interviews.py`, `filesystem.py`, `config.py`, `main.py` e `niche_analyzer.py`;
    - um teste compara `DOCS` com os literais do `pipeline.py`, então qualquer divergência quebra o build.
  - **Services novos:**
    - `services/interview_runner.py`: tudo o que era `_run_job` e a lógica de etapas em `routes/interviews.py`; o contrato dos prefixos das mensagens do pipeline foi preservado e testado;
    - `services/prompt_store.py`: prompts com captura do padrão, backup e restore; escrita atômica; os services de refine, structure, glossary e niche_analysis carregam por ele;
    - `services/model_config.py`: overrides da UI e allowlist; ignora chaves legadas no JSON e tolera JSON corrompido.
  - **`llm_client`:**
    - `resolve_model` público, com `ValueError` para tarefa desconhecida; os fallbacks `mistral:free` e `haiku` foram removidos;
    - `call` e `call_with_model` compartilham `_invoke` (log, tempo, validação);
    - resposta vazia e `content None` viram erro claro;
    - truncamento por max_tokens gera aviso no log;
    - timeout de 300 s nos três providers;
    - retry de 429 simplificado;
    - `_NO_SYSTEM_PROMPT_MODELS` removido; o `basicConfig` saiu do import e foi para `main.py`.
  - **Storage:** `write_text_atomic` (tmp + `os.replace`) em markdown, meta, prompts e modelos; `upload_tmp_root()`; model config saiu do `filesystem.py`.
  - **API:**
    - `api/schemas.py` com `response_model` em todos os endpoints;
    - `routes/system.py` com `/status` e `/pipeline/jobs`;
    - rotas finas (`interviews.py` caiu de 388 para cerca de 190 linhas, `config.py` de 184 para cerca de 95).
  - **Logging:** `print` virou `logging` em `converter`, `transcriber` e `refiner`; `import struct` morto removido.
- **Por quê:** uma só fonte de verdade para nomes e tarefas, rotas sem lógica de negócio e um cliente LLM sem duplicação.
- **Arquivos:** `backend/core/layout.py`, `backend/api/{main,schemas}.py`, `backend/api/routes/{interviews,niches,config,system}.py`, `backend/services/{interview_runner,prompt_store,model_config,llm_client,niche_analyzer,refiner,structurer,glossary,converter,transcriber}.py`, `backend/storage/filesystem.py`, `backend/tests/*`.
- **Evidência dos gates:**
  - `py_compile`: OK;
  - `pytest`: **89 passed**;
  - `git diff -- backend/core/pipeline.py`: vazio.
- **Riscos e pendências:**
  - **Contrato do frontend:** os `response_model` expõem exatamente os campos antigos; a E3 revisa `api.ts` contra eles.
  - **`/openapi.json` e `/docs`:** continuam públicos mesmo com `API_SECRET_KEY` (só descrevem o schema, sem dados).
  - **Itens de baixa prioridade deixados:**
    - Whisper compartilhado entre threads sem lock;
    - SDK deprecado do Gemini;
    - `_ffmpeg_available()` chamado a cada uso.

---

## E3 — Frontend: fundação e limpeza

- **O quê:**
  - **Legado removido:**
    - aba e ações de consolidação em `nicho/[nicho]/page.tsx`;
    - as páginas `/nicho/[nicho]/glossario` e `.../glossario/print`. O glossário consolidado do nicho deixa de existir, e o das entrevistas continua;
    - as tarefas `consolidate*` em `ModelSettings` e `PromptSettings`;
    - `getJobStatus`, `EditableDocType`, `AuthUser` e os cinco SVGs padrão de `public/`;
    - a dependência `date-fns`;
    - `store.ts` caiu de 48 para 25 linhas (`jobs` e `selected*` eram código morto); só `currentFile` fica, provisório até a E6 mover o documento ativo para `?doc=`.
  - **`lib/api.ts` reescrito:**
    - helpers `interviewPath` e `nichePath` com `encodeURIComponent` em um só lugar;
    - `ApiError` e interceptor que extraem o `detail` do FastAPI (string ou lista de validação), distinguem 401 e backend inalcançável, e `errorMessage()`;
    - o header `Authorization` só é enviado quando há secret;
    - tipos unificados: `DocType = keyof InterviewStages`, `JobStatus` único, `Job.stages: Stage[]` sempre presente, e `JobStage` removido (usa `Stage` de `pipeline.ts`);
    - upload monta os campos de meta por tabela e não mais um `if` por campo.
  - **Novo:** `lib/query-keys.ts` (`qk`), com uma chave por recurso. Será usado pelas páginas na E6.
  - **Bug:** a busca do glossário não ignorava acentos ("agil" não achava "ágil"). A regex `/̀-ͯ/g` não tinha colchetes e procurava 3 caracteres literais. Agora há um helper `stripAccents` com a faixa montada por `String.fromCharCode`, para não depender de caracteres invisíveis no fonte.
  - **Pequenos:** `FILENAME_TO_DOC` e `stagesFromInterview` usam os tipos de `api.ts`; o upload não grava mais um job no store que ninguém lia.
- **Por quê:** uma camada de dados tipada e sem duplicação antes de redesenhar as telas.
- **Decisões que divergem do plano:**
  - **`shadcn` continua em `dependencies`:** `globals.css` faz `@import "shadcn/tailwind.css"` no build, então não é só CLI. A ideia de movê-lo para `devDependencies` foi descartada.
  - **Hooks e AmbientBackground:** os hooks (`useJobs`, `useSystemStatus`, `useAnalysisJob`) e a remoção de `AmbientBackground`, `VisualSettings` e `visual-preferences.ts` passam para E4–E6. Criá-los agora forçaria editar duas vezes as páginas que a E6 reescreve.
- **Arquivos:** `frontend-next/src/lib/{api,query-keys,pipeline,files,glossary,store,supabase}.ts`, `src/app/(app)/nicho/[nicho]/page.tsx`, `src/app/(app)/upload/page.tsx`, `src/app/(app)/nicho/[nicho]/[entrevista]/page.tsx`, `src/components/settings/{Model,Prompt}Settings.tsx`, `package.json`, `package-lock.json`.
- **Evidência dos gates:**
  - `tsc --noEmit`: exit 0, depois de todas as edições;
  - `npm run lint`: 17 problemas (15 erros, 2 warnings), **igual à baseline** (não aumentou);
  - `npm run build`: OK, 10 rotas (eram 12), executado antes do último ajuste em `ModelSettings`/`PromptSettings`, que foi validado só com `tsc`; o build é refeito no fechamento da E4.
- **Riscos e pendências:**
  - **Busca com acento não verificada no browser:** a verificação funcional ("agil" encontra "ágil") fica para a E7.
  - **Lint herdado:** os 15 erros herdados (`react-hooks/set-state-in-effect` e afins) continuam; as páginas e componentes que os contêm são reescritos na E5/E6, e o lint deve fechar em 0 erros ali.

---

## E4 — Design system "Caderno de Campo"

- **O quê:**
  - **`globals.css` reescrito:** tokens em oklch para claro (padrão) e escuro grafite quente.
    - **Cores:**
      - papel off-white, tinta grafite, acento verde-petróleo e marca-texto âmbar;
      - tons semânticos novos `success`, `warning`, `info`, `highlight` e `destructive-soft`, cada um com variantes `-soft` e `-foreground` pensadas para contraste de texto (substituirão as 45 cores `emerald-*`/`amber-*` fixas).
    - **Tipografia e medidas:** escala `text-2xs` (substitui os `text-[10px]`/`[11px]`) e raio base de 0.5rem.
    - **`.crivo-prose` para leitura longa:** medida de 72ch, títulos em serifa, `h4` como rótulo, citação com barra de marca-texto em itálico serifado, tabelas com rolagem horizontal.
    - **Tema de código:** `highlight.js` por tokens `--hl-*` em vez do tema `github-dark.css` fixo.
    - **Impressão:** o bloco foi preservado.
    - **Seleção e movimento reduzido:** `::selection` agora é o marca-texto; `prefers-reduced-motion` desliga todas as animações.
  - **Fontes locais:** `@fontsource-variable` Inter, Source Serif 4 e JetBrains Mono. Nada é baixado no build, o que evita repetir o problema do commit `92de5b2`.
  - **`ThemeProvider`:** `defaultTheme="light"`, `storageKey="crivo:theme:v2"` (quem tinha o antigo padrão escuro volta ao claro), `disableTransitionOnChange`.
  - **Componentes `ui/` via shadcn CLI 4.5.0 (base-ui, sem `asChild`):** `select`, `checkbox`, `switch`, `dialog`, `alert-dialog`, `sheet`, `tooltip`, `dropdown-menu`, `skeleton`, `separator`, `breadcrumb`, `table`, `popover`, `command` e `input-group`. O `button`, o `input` e o `textarea` foram atualizados para a versão do registry.
  - **`components/common/`:** `Logo` e `LogoMark` (peneira de pontos), `PageHeader`, `PageContainer`, `SectionLabel`, `StatusBadge` e `StatusIcon`, `EmptyState`, `ErrorState` e `LoadingState`. `ErrorState` separa falha real de "ainda não gerado".
  - **`lib/status.ts`:** mapa único de status → rótulo e tom. É a fonte que substituirá as cinco cópias existentes.
  - **Marca:** `app/icon.svg` (favicon) com a mesma peneira. Fecha a pendência de logo e favicon.
  - **Compatibilidade temporária:** as classes `.glass*`, `.glow-*` e `.gradient-*` viram equivalentes neutros e `.ambient-blob` fica oculto, até a E6 remover os usos. O `dialog` antigo, feito à mão, virou `dialog-legacy.tsx` (2 usos), para sair na E6.
- **Por quê:** definir o sistema (tokens, tipografia e componentes) uma vez, antes de redesenhar as telas.
- **Ocorrência de segurança de cadeia de suprimentos (corrigida):** a CLI do shadcn 4.5.0 reescreveu os imports dos componentes para `from "cn"` e adicionou ao `package.json` um pacote npm homônimo, `cn@0.4.0`, em vez de usar o `@/lib/utils` do projeto.
  - Todos os imports foram reapontados para `@/lib/utils` (25 arquivos conferidos) e o pacote `cn` foi desinstalado (ausente de `node_modules` e do `package.json`).
  - Os imports de todos os componentes `ui/` foram auditados: só `@base-ui/react/*`, `lucide-react`, `class-variance-authority`, `cmdk`, `sonner`, `next-themes`, `react` e `react-dom`.
  - **Para futuras adições com a CLI:** conferir os imports e o `package.json` depois de cada `shadcn add`.
- **Arquivos:** `src/app/{globals.css,layout.tsx,icon.svg}`, `src/components/{ui/*,common/*,theme/ThemeProvider.tsx}`, `src/lib/status.ts`, `package.json`, `package-lock.json`.
- **Evidência dos gates:**
  - `tsc --noEmit`: exit 0;
  - `npm run lint`: 17 problemas (15 erros, 2 warnings), **igual à baseline**;
  - `npm run build`: OK, 11 rotas (inclui `/icon.svg`);
  - verificação visual em `/login`:
    - fundo papel, tema claro por padrão;
    - Inter e Source Serif 4 carregadas localmente (`document.fonts`);
    - título em serifa e botão verde-petróleo.
- **Riscos e pendências:**
  - **Contraste AA não medido:** será checado na E7. Os tons `-foreground` foram escolhidos com diferença de luminosidade de pelo menos 0.5 sobre o `-soft`.
  - **Páginas ainda no visual antigo:** dashboard, upload, entrevista etc. continuam com a estrutura antiga sob a nova paleta; E5/E6 as redesenham.
  - **Tema de código por tokens:** a E7 confere visualmente em claro e escuro.
