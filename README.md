# Interview Insights

Sistema interno de discovery e extração de insights de entrevistas de negócio.

## Fluxo do pipeline

```
Arquivo original (vídeo ou áudio)
        │
        ▼
   raw/ ← cópia preservada do arquivo original
        │
        ▼
  FFmpeg → processed/audio.wav (16kHz mono)
        │
        ▼
  Split → parts/part_001.wav, part_002.wav... (se > AUDIO_CHUNK_MB)
        │
        ▼
  Whisper local → transcrição bruta
        │
        ▼
  outputs/01_transcricao_bruta.md
        │
        ▼
  Claude (refine.txt) → corrige gramática sem alterar conteúdo
        │
        ▼
  outputs/02_transcricao_refinada.md
        │
   ┌────┴────┐
   ▼         ▼
Claude      Claude
(structure) (glossary)
   │              │
   ▼              ▼
outputs/       glossary/
03_entrevista  glossario_local.md
_estruturada.md
```

### Consolidação por nicho (após múltiplas entrevistas)

```
Todos os 03_entrevista_estruturada.md do nicho
        │
        ▼
  Claude (consolidate.txt)
        │
        ▼
  _insights/01_insights_consolidados.md

Todos os glossario_local.md do nicho
        │
        ▼
  Claude (consolidate_glossary.txt)
        │
        ▼
  _glossary/glossario_nicho.md
```

## Estrutura de pastas gerada

```
data/niches/
└── {nicho}/
    ├── {entrevista-1}/
    │   ├── raw/                         ← arquivo original preservado
    │   │   └── entrevista.mp4
    │   ├── processed/
    │   │   └── audio.wav                ← WAV convertido (16kHz mono)
    │   ├── parts/
    │   │   ├── part_001.wav             ← partes (apenas se o áudio for grande)
    │   │   └── part_002.wav
    │   ├── outputs/
    │   │   ├── 01_transcricao_bruta.md
    │   │   ├── 02_transcricao_refinada.md
    │   │   └── 03_entrevista_estruturada.md
    │   └── glossary/
    │       └── glossario_local.md
    ├── {entrevista-2}/
    │   └── ...
    ├── _insights/
    │   └── 01_insights_consolidados.md  ← gerado após consolidação
    └── _glossary/
        └── glossario_nicho.md           ← gerado após consolidação
```

## Documento 03_entrevista_estruturada.md

Contém obrigatoriamente:

1. **Contexto** — perfil do entrevistado
2. **Rotina** — dia a dia e responsabilidades
3. **Processos** — fluxos de trabalho descritos
4. **Ferramentas** — sistemas e softwares mencionados
5. **Falas Importantes** — citações diretas revelantes
6. **Dores Identificadas** — lista numerada (D1, D2...)
7. **Classificação das Dores** — tabela com 7 atributos por dor:
   - Frequência, Intensidade, Impacto em tempo, Impacto em dinheiro, Urgência, Já tentou resolver, Sinal de disposição para pagar
8. **Sinais de Urgência**
9. **Sinais de Disposição para Pagar**
10. **Oportunidades de Solução**

## Configuração

```bash
# 1. Criar ambiente e instalar dependências
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Instalar FFmpeg (necessário para conversão de áudio)
# Windows: https://ffmpeg.org/download.html  (adicionar ao PATH)
# Mac:     brew install ffmpeg
# Linux:   sudo apt install ffmpeg

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env e preencher ANTHROPIC_API_KEY

# 4. Iniciar backend (Terminal 1)
run_backend.bat      # Windows
# ou: ./run_backend.sh

# 5. Iniciar frontend (Terminal 2)
run_frontend.bat     # Windows
# ou: ./run_frontend.sh

# Acessar em: http://localhost:8501
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `ANTHROPIC_API_KEY` | — | Chave da API Anthropic (obrigatório) |
| `WHISPER_MODEL` | `base` | Modelo Whisper: `tiny`, `base`, `small`, `medium`, `large` |
| `AUDIO_CHUNK_MB` | `24` | Tamanho máximo de cada parte do áudio em MB |
| `DATA_DIR` | `./data/niches` | Diretório raiz de saída |

## Prompts

Os prompts estão em `backend/prompts/` e podem ser editados sem alterar código:

| Arquivo | Função |
|---------|--------|
| `refine.txt` | Corrige transcrição bruta sem resumir |
| `structure.txt` | Estrutura entrevista com 10 seções + classificação de dores |
| `glossary.txt` | Extrai termos do nicho da transcrição refinada |
| `consolidate.txt` | Consolida insights de N entrevistas do nicho |
| `consolidate_glossary.txt` | Unifica glossários locais em glossário do nicho |

## Arquitetura

```
backend/
├── api/routes/       # FastAPI: endpoints de upload, status, documentos, consolidação
├── core/
│   ├── config.py     # Settings via .env
│   └── pipeline.py   # Orquestrador: chama serviços em sequência
├── services/
│   ├── converter.py  # FFmpeg: WAV + split em partes
│   ├── transcriber.py# Whisper local com cache do modelo
│   ├── refiner.py    # Claude: refinamento gramatical em chunks
│   ├── structurer.py # Claude: estruturação + insights
│   ├── glossary.py   # Claude: glossário local
│   └── consolidator.py # Claude: consolidação de insights e glossário
├── prompts/          # Prompts editáveis em .txt
└── storage/
    └── filesystem.py # Cria pastas, lê e salva MDs
frontend/
└── app.py            # Interface Streamlit (3 abas)
```
