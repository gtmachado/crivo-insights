"""
Teste ponta a ponta do pipeline com mocks de FFmpeg, Whisper e Claude API.

Execução:
    cd interview-insights
    python test_pipeline.py

O teste:
  1. Gera um WAV sintético de 2 segundos (sem FFmpeg)
  2. Mocka convert_to_wav, split_wav, transcribe_chunks e anthropic.Anthropic
  3. Roda run_pipeline() com dados reais de pasta/arquivo
  4. Lista todos os arquivos gerados e valida conteúdo
  5. Aponta erros potenciais encontrados
"""
import sys
import wave
import struct
import math
import shutil
import traceback

# Garante saida UTF-8 no terminal Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import datetime

# Garante que o PYTHONPATH inclui a raiz do projeto
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

# ─── Configuração de ambiente para o teste ────────────────────────────────────
import os
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-key-for-dry-run")
os.environ["DATA_DIR"] = str(ROOT / "data" / "test_niches")

# ─── Dados do teste ───────────────────────────────────────────────────────────
TEST_NICHE = "clinicas-de-estetica"
TEST_INTERVIEW = "Joao Silva - Dono de Clinica"
TEST_AUDIO_NAME = "entrevista_joao.wav"

MOCK_RAW_TRANSCRIPTION = """\
então a maior dificuldade que eu tenho hoje é o controle de agenda sabe
a gente usa uma planilha mas ela não funciona bem quando tem mais de uma
atendente marcando ao mesmo tempo acaba gerando conflito de horário
e o cliente reclama muito disso

outro problema é o controle de estoque dos produtos que a gente usa nas
sessões eu nunca sei exatamente o quanto tem de cada coisa e as vezes
a gente começa um procedimento e não tem o produto suficiente aí precisa
remarcar e isso é péssimo pra experiência do cliente

a gente fatura em torno de vinte a trinta mil por mês mas eu acho que
poderia ser mais se a gente perdesse menos clientes por essas questões
operacionais
"""

MOCK_REFINED_TRANSCRIPTION = """\
Então, a maior dificuldade que eu tenho hoje é o controle de agenda, sabe?
A gente usa uma planilha, mas ela não funciona bem quando tem mais de uma
atendente marcando ao mesmo tempo. Acaba gerando conflito de horário,
e o cliente reclama muito disso.

Outro problema é o controle de estoque dos produtos que a gente usa nas
sessões. Eu nunca sei exatamente o quanto tem de cada coisa, e às vezes
a gente começa um procedimento e não tem o produto suficiente. Aí precisa
remarcar, e isso é péssimo para a experiência do cliente.

A gente fatura em torno de vinte a trinta mil por mês, mas eu acho que
poderia ser mais se a gente perdesse menos clientes por essas questões
operacionais.
"""

MOCK_STRUCTURED = """\
# Entrevista - João Silva - Clínicas de Estética

## Contexto
João Silva é dono de uma clínica de estética de pequeno porte...

## Rotina
Gerencia agenda, atendimento e estoque de forma manual...

## Processos
Agendamento via planilha compartilhada entre atendentes...

## Ferramentas
- Planilha Google Sheets para agenda (insatisfeito)

## Falas importantes
> "A maior dificuldade que eu tenho hoje é o controle de agenda."
> "Às vezes começa um procedimento e não tem o produto suficiente."

## Dores identificadas
- D1: Conflito de horários no agendamento simultâneo
- D2: Falta de controle de estoque de produtos

## Classificação das dores
| # | Dor | Frequência | Intensidade | Impacto em tempo | Impacto em dinheiro | Urgência | Já tentou resolver? | Sinal de pagamento |
|---|-----|------------|-------------|-----------------|---------------------|----------|---------------------|--------------------|
| D1 | Conflito de agenda | Diária | Alta | 1-2h/dia | Perda de clientes | Alta | Sim (planilha) | Indício |
| D2 | Estoque impreciso | Semanal | Média | 30min/semana | Remarcações | Média | Não | Não informado |

## Sinais de urgência
- Clientes reclamando ativamente de conflitos de horário.

## Sinais de disposição para pagar
- Fatura R$20-30k/mês, reconhece que perde receita por problemas operacionais.

## Oportunidades de solução
- Sistema de agendamento online com bloqueio de horário em tempo real (resolve D1) - SaaS
- Módulo de controle de estoque integrado ao agendamento (resolve D2) - SaaS
"""

MOCK_GLOSSARY = """\
# Glossário - Clínicas de Estética

## Procedimento
**Definição:** Serviço estético realizado na clínica (ex: limpeza de pele, laser).
**Exemplo de uso:** "A gente começa um procedimento e não tem o produto suficiente."
**Termos relacionados:** sessão, tratamento

## Remarcação
**Definição:** Reagendamento de um atendimento cancelado ou interrompido.
**Exemplo de uso:** "Aí precisa remarcar, e isso é péssimo para a experiência do cliente."
**Termos relacionados:** cancelamento, conflito de agenda
"""

# ─── Helpers de output ────────────────────────────────────────────────────────

SEP = "-" * 60

def section(title: str):
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)

def ok(msg: str):
    print(f"  [OK]   {msg}")

def warn(msg: str):
    print(f"  [WARN] {msg}")

def err(msg: str):
    print(f"  [ERR]  {msg}")

def info(msg: str):
    print(f"  [>]    {msg}")

# ─── Gerar WAV sintético ──────────────────────────────────────────────────────

def create_synthetic_wav(path: Path) -> Path:
    """Gera WAV de 2 segundos (tom 440 Hz) sem precisar de FFmpeg."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(16000)
        frames = [
            struct.pack("<h", int(32767 * math.sin(2 * math.pi * 440 * i / 16000)))
            for i in range(16000 * 2)
        ]
        f.writeframes(b"".join(frames))
    return path

# ─── Mocks ────────────────────────────────────────────────────────────────────

def mock_convert_to_wav(input_path: Path, processed_dir: Path) -> Path:
    """Simula conversão: apenas copia o WAV de entrada."""
    out = processed_dir / "audio.wav"
    processed_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(input_path, out)
    return out

def mock_split_wav(wav_path: Path, parts_dir: Path) -> list[Path]:
    """Simula split: retorna o próprio WAV (arquivo pequeno, sem divisão)."""
    return [wav_path]

def mock_transcribe_chunks(chunks: list[Path]) -> str:
    return MOCK_RAW_TRANSCRIPTION

def make_mock_anthropic():
    """Retorna um mock de anthropic.Anthropic que alterna respostas por chamada."""
    responses = [MOCK_REFINED_TRANSCRIPTION, MOCK_STRUCTURED, MOCK_GLOSSARY]
    call_count = {"n": 0}

    mock_client = MagicMock()

    def fake_create(**kwargs):
        idx = min(call_count["n"], len(responses) - 1)
        call_count["n"] += 1
        msg = MagicMock()
        msg.content = [MagicMock(text=responses[idx])]
        return msg

    mock_client.messages.create.side_effect = fake_create
    return mock_client

# ─── Validadores ──────────────────────────────────────────────────────────────

def validate_file(path: Path, label: str) -> bool:
    if not path.exists():
        err(f"{label} NÃO encontrado: {path}")
        return False
    size = path.stat().st_size
    if size == 0:
        warn(f"{label} está VAZIO: {path}")
        return False
    ok(f"{label} ({size:,} bytes) -> {path.relative_to(ROOT)}")
    return True

def show_file_tree(base: Path):
    section("Árvore de arquivos gerada")
    niche_root = base.parent
    for p in sorted(niche_root.rglob("*")):
        if p.is_file():
            rel = p.relative_to(niche_root)
            parts = rel.parts
            indent = "  " + "|   " * (len(parts) - 1) + "+-- "
            print(f"{indent}{p.name}  ({p.stat().st_size:,} bytes)")

def check_potential_errors():
    section("Erros potenciais identificados")

    # FFmpeg
    import subprocess
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True)
        if r.returncode != 0:
            warn("FFmpeg encontrado mas retornou erro.")
        else:
            first_line = r.stdout.decode(errors="replace").split("\n")[0]
            ok(f"FFmpeg disponivel: {first_line}")
    except FileNotFoundError:
        warn("FFmpeg NAO encontrado no PATH - conversao de video/mp3 falhara em producao.")
        warn("  Instale: https://ffmpeg.org/download.html e adicione ao PATH.")

    # API key real
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if key.startswith("sk-ant-test"):
        warn("ANTHROPIC_API_KEY é a chave de teste - configure a chave real no .env antes de usar em produção.")
    else:
        ok("ANTHROPIC_API_KEY configurada.")

    # Whisper
    try:
        import whisper
        ok(f"Whisper disponível (openai-whisper instalado).")
        info(f"  Modelo configurado: {os.environ.get('WHISPER_MODEL', 'base')} - será baixado no primeiro uso real.")
    except ImportError:
        warn("openai-whisper NÃO instalado - instale com: pip install openai-whisper")

    # torch
    try:
        import torch
        ok(f"PyTorch disponível: {torch.__version__}")
        if torch.cuda.is_available():
            info(f"  GPU disponível: {torch.cuda.get_device_name(0)} - transcrição será muito mais rápida.")
        else:
            info("  GPU não disponível - transcrição usará CPU (mais lenta para modelos grandes).")
    except ImportError:
        warn("PyTorch NÃO instalado.")

# ─── Teste principal ──────────────────────────────────────────────────────────

def run_test():
    print(f"\n{'=' * 60}")
    print(f"  TESTE PONTA A PONTA - Interview Insights Pipeline")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}")

    # Limpar dados de teste anteriores
    test_data_dir = ROOT / "data" / "test_niches"
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir)

    # Criar WAV sintético em local temporário
    tmp_wav = ROOT / "data" / "_tmp_test" / TEST_AUDIO_NAME
    create_synthetic_wav(tmp_wav)

    section("Etapa 0 - Arquivo de entrada")
    ok(f"WAV sintético gerado: {tmp_wav.relative_to(ROOT)} ({tmp_wav.stat().st_size:,} bytes, 2s @ 16kHz mono)")

    steps_log: list[str] = []

    def on_step(msg: str):
        steps_log.append(msg)

    # Executar pipeline com mocks
    mock_client = make_mock_anthropic()

    section("Etapa 1-8 - Executando pipeline com mocks")
    paths = {}
    error = None

    # Importa o pipeline antes de patchar (evita problemas de ordem de import)
    from backend.core import pipeline as pipeline_mod
    from backend.services import refiner, structurer, glossary

    try:
        with (
            patch.object(pipeline_mod, "convert_to_wav", side_effect=mock_convert_to_wav),
            patch.object(pipeline_mod, "split_wav", side_effect=mock_split_wav),
            patch.object(pipeline_mod, "transcribe_chunks", side_effect=mock_transcribe_chunks),
            patch("backend.services.refiner.anthropic.Anthropic", return_value=mock_client),
            patch("backend.services.structurer.anthropic.Anthropic", return_value=mock_client),
            patch("backend.services.glossary.anthropic.Anthropic", return_value=mock_client),
        ):
            paths = pipeline_mod.run_pipeline(tmp_wav, TEST_NICHE, TEST_INTERVIEW, on_step=on_step)
    except Exception as e:
        error = e
        err(f"Pipeline falhou: {e}")
        traceback.print_exc()

    # Log de etapas
    for step in steps_log:
        info(step)

    if error:
        sys.exit(1)

    # Validar arquivos gerados
    section("Arquivos gerados - validação")

    from backend.storage.filesystem import interview_dir, _slugify
    base = interview_dir(TEST_NICHE, TEST_INTERVIEW)

    expected = {
        "Original preservado em raw/":      base / "raw" / TEST_AUDIO_NAME,
        "WAV convertido em processed/":     base / "processed" / "audio.wav",
        "Transcrição bruta":               base / "outputs" / "01_transcricao_bruta.md",
        "Transcrição refinada":            base / "outputs" / "02_transcricao_refinada.md",
        "Entrevista estruturada":          base / "outputs" / "03_entrevista_estruturada.md",
        "Glossário local":                 base / "glossary" / "glossario_local.md",
    }

    all_ok = True
    for label, path in expected.items():
        if not validate_file(path, label):
            all_ok = False

    # Verificar que parts/ existe (mesmo sem divisão)
    parts_dir = base / "parts"
    if parts_dir.exists():
        ok(f"Diretório parts/ criado (vazio - áudio pequeno, sem divisão necessária)")
    else:
        warn("Diretório parts/ não foi criado pelo interview_dir()")

    # Mostrar conteúdo de amostra
    section("Amostra - 01_transcricao_bruta.md (primeiras 5 linhas)")
    raw_path = base / "outputs" / "01_transcricao_bruta.md"
    if raw_path.exists():
        lines = raw_path.read_text(encoding="utf-8").splitlines()[:8]
        for line in lines:
            print(f"  {line}")

    section("Amostra - 03_entrevista_estruturada.md (primeiras 10 linhas)")
    struct_path = base / "outputs" / "03_entrevista_estruturada.md"
    if struct_path.exists():
        lines = struct_path.read_text(encoding="utf-8").splitlines()[:10]
        for line in lines:
            print(f"  {line}")

    show_file_tree(base)
    check_potential_errors()

    section("Resultado")
    if all_ok:
        print(f"\n  [SUCESSO] Pipeline ponta a ponta concluido!")
        print(f"  Todos os {len(expected)} arquivos esperados foram gerados.\n")
    else:
        print(f"\n  [FALHA] Pipeline com problemas - verifique os avisos acima.\n")

    # Limpar tmp
    shutil.rmtree(ROOT / "data" / "_tmp_test", ignore_errors=True)

    return all_ok


if __name__ == "__main__":
    ok_result = run_test()
    sys.exit(0 if ok_result else 1)
