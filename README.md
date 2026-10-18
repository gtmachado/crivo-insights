# Crivo Insights

Plataforma interna de descoberta de mercado a partir de entrevistas qualitativas. Você envia a gravação de uma entrevista; o Crivo transcreve, refina, estrutura e extrai um glossário. Depois, reúne várias entrevistas de um nicho em uma análise.

- **Backend:** FastAPI + Python 3.11 (`backend/`)
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS v4 + shadcn (base-ui) (`frontend-next/`)
- **Dados:** pastas em disco, `data/niches/{nicho}/{entrevista}/`

## Fluxo do pipeline

```
Arquivo original (vídeo ou áudio)
   → raw/                 cópia preservada
   → processed/audio.wav  FFmpeg, 16 kHz mono
   → parts/               trechos, se passar de AUDIO_CHUNK_MB
   → Whisper local        outputs/01_transcricao_bruta.md
   → LLM (refine)         outputs/02_transcricao_refinada.md   (separa entrevistador/entrevistado)
   → LLM (structure)      outputs/03_entrevista_estruturada.md
   → LLM (glossary)       glossary/glossario_local.md
```

Depois, na página do nicho, você escolhe entrevistas estruturadas e gera a **análise do nicho**
(`data/niches/{nicho}/_insights/analise_{nicho}.md`) com Claude Sonnet 4.6 (modelo fixo).

## Estrutura em disco

```
data/niches/{nicho}/
├── {entrevista}/
│   ├── raw/ processed/ parts/
│   ├── outputs/   01_transcricao_bruta.md, 02_transcricao_refinada.md, 03_entrevista_estruturada.md
│   ├── glossary/  glossario_local.md
│   └── metadata.json      título, entrevistado, entrevistador, contato, observações
└── _insights/analise_{nicho}.md
data/config/models.json    modelos escolhidos em Configurações (não versionado)
```

O documento `03_entrevista_estruturada.md` traz contexto, rotina, processos, ferramentas, falas importantes,
dores (com classificação em 7 atributos), sinais de urgência e de disposição para pagar, e oportunidades.

## Como rodar

```bash
# 1. Backend — Python 3.11
python -m venv venv && venv\Scripts\activate        # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt                      # testes: pip install -r requirements-dev.txt
# FFmpeg precisa estar no PATH (https://ffmpeg.org/download.html)

cp .env.example .env     # preencha OPENROUTER_API_KEY (ou outro provedor) e API_SECRET_KEY
run_backend.bat          # Linux/Mac: ./run_backend.sh  →  http://localhost:8000

# 2. Frontend
cd frontend-next
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_API_SECRET, chaves do Supabase
npm install
npm run dev                  # http://localhost:3000
```

`dev.bat` sobe backend, ngrok e frontend em janelas separadas. A URL do backend e o token também podem ser
trocados em **Configurações → Conexão**, sem redeploy.

## Variáveis de ambiente (backend)

| Variável | Padrão | Descrição |
|---|---|---|
| `API_SECRET_KEY` | — | Token exigido em todas as rotas (exceto `/health`), por `Authorization: Bearer` ou `?token=`. Vazio = sem proteção (só dev local). |
| `LLM_PROVIDER` | `openrouter` | `openrouter`, `gemini` ou `anthropic` |
| `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | — | Chave do provedor ativo. A análise de nicho usa OpenRouter ou Anthropic. |
| `MODEL_REFINE` / `MODEL_STRUCTURE` / `MODEL_GLOSSARY` | — | Sobrescrevem o modelo de cada etapa (a UI tem prioridade sobre o `.env`) |
| `WHISPER_MODEL` | `medium` | `tiny`, `base`, `small`, `medium`, `large` |
| `AUDIO_CHUNK_MB` | `24` | Tamanho máximo de cada parte do áudio |
| `DATA_DIR` | `./data/niches` | Raiz dos dados |

## Prompts

Ficam em `backend/prompts/*.md` e são editáveis em **Configurações → Prompts** (a UI guarda o padrão na primeira
edição, faz backup a cada alteração e permite restaurar).

| Arquivo | Etapa |
|---|---|
| `refine_prompt.md` | Refino da transcrição, com separação de participantes |
| `structure_prompt.md` | Estruturação da entrevista e classificação de dores |
| `glossary_prompt.md` | Glossário local |
| `niche_analysis.md` | Análise do nicho |

## Arquitetura do backend

```
backend/
├── api/
│   ├── main.py            app, CORS, auth em todos os routers
│   ├── auth.py            verify_token (Bearer ou ?token=)
│   ├── schemas.py         modelos de entrada/saída da API
│   └── routes/            interviews, niches, config, media, system
├── core/
│   ├── config.py          settings (.env)
│   ├── layout.py          nomes de arquivo, tarefas LLM e modelos fixos (fonte única)
│   └── pipeline.py        orquestrador — NÃO modificar
├── services/
│   ├── interview_runner.py  roda o pipeline como job e deriva as etapas das mensagens
│   ├── jobs.py              JobStore em memória, thread-safe
│   ├── llm_client.py        provedores LLM; call() e call_with_model()
│   ├── prompt_store.py      prompts editáveis com backup/restore
│   ├── model_config.py      modelos escolhidos pela UI
│   ├── niche_analyzer.py    análise do nicho (Sonnet 4.6 fixo)
│   └── converter / transcriber / refiner / structurer / glossary
├── storage/filesystem.py    toda a I/O de disco (escrita atômica)
└── tests/                   pytest — 91 testes, isolados em diretório temporário
```

## Testes e validação

```bash
python -m pytest                      # backend (pip install -r requirements-test.txt basta; sem torch/whisper)
cd frontend-next && npm run lint && npx tsc --noEmit && npm run build
```

O CI (`.github/workflows/ci.yml`) roda esses mesmos comandos em todo PR e em `push` na `main`.

Veja `docs/refactor/LOG.md` para o histórico da refatoração e do facelift "Caderno de Campo".
