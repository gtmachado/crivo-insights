"""Orquestrador do pipeline completo de uma entrevista."""
import shutil
from pathlib import Path
from datetime import datetime

from backend.storage.filesystem import interview_dir, save_markdown
from backend.services.converter import convert_to_wav, split_wav, SUPPORTED_INPUT
from backend.services.transcriber import transcribe_chunks
from backend.services.refiner import refine_transcription
from backend.services.structurer import structure_interview
from backend.services.glossary import generate_glossary


def _header(title: str, niche: str, interview: str) -> str:
    return (
        f"---\n"
        f"título: {title}\n"
        f"nicho: {niche}\n"
        f"entrevista: {interview}\n"
        f"gerado_em: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"---\n\n"
    )


def run_pipeline(
    input_file: Path,
    niche: str,
    interview_name: str,
    on_step: callable = print,
) -> dict[str, Path]:
    """
    Executa o pipeline completo e retorna um dict com os caminhos gerados.
    `on_step(msg)` é chamado a cada etapa para feedback de progresso.
    """
    suffix = input_file.suffix.lower()
    if suffix not in SUPPORTED_INPUT:
        raise ValueError(f"Formato não suportado: {suffix}. Suportados: {SUPPORTED_INPUT}")

    base = interview_dir(niche, interview_name)
    paths: dict[str, Path] = {}

    # 1. Preservar arquivo original em raw/
    on_step("Preservando arquivo original em raw/...")
    raw_original = base / "raw" / input_file.name
    if not raw_original.exists():
        shutil.copy2(input_file, raw_original)
    paths["original"] = raw_original

    # 2. Converter para WAV em processed/
    on_step("Convertendo para WAV (16kHz mono)...")
    wav = convert_to_wav(input_file, base / "processed")

    # 3. Dividir em partes se necessário
    on_step("Verificando tamanho do áudio...")
    parts = split_wav(wav, base / "parts")
    on_step(f"  {len(parts)} parte(s) para transcrever.")

    # 4. Transcrever
    on_step("Transcrevendo com Whisper...")
    raw_text = transcribe_chunks(parts)

    # 5. Salvar transcrição bruta
    raw_md = _header("Transcrição Bruta", niche, interview_name) + raw_text
    raw_path = base / "outputs" / "01_transcricao_bruta.md"
    save_markdown(raw_path, raw_md)
    paths["raw"] = raw_path
    on_step(f"Transcrição bruta salva → outputs/01_transcricao_bruta.md")

    # 6. Refinar
    on_step("Refinando transcrição com Claude...")
    refined_text = refine_transcription(raw_text)
    refined_md = _header("Transcrição Refinada", niche, interview_name) + refined_text
    refined_path = base / "outputs" / "02_transcricao_refinada.md"
    save_markdown(refined_path, refined_md)
    paths["refined"] = refined_path
    on_step(f"Transcrição refinada salva → outputs/02_transcricao_refinada.md")

    # 7. Estruturar + insights (lê do refinado)
    on_step("Estruturando entrevista e extraindo insights com Claude...")
    structured_text = structure_interview(refined_text, interview_name, niche)
    structured_path = base / "outputs" / "03_entrevista_estruturada.md"
    save_markdown(structured_path, structured_text)
    paths["structured"] = structured_path
    on_step(f"Documento estruturado salvo → outputs/03_entrevista_estruturada.md")

    # 8. Glossário local (lê do refinado, não do estruturado)
    on_step("Gerando glossário local com Claude...")
    glossary_text = generate_glossary(refined_text, niche)
    glossary_path = base / "glossary" / "glossario_local.md"
    save_markdown(glossary_path, glossary_text)
    paths["glossary"] = glossary_path
    on_step(f"Glossário salvo → glossary/glossario_local.md")

    on_step("✓ Pipeline concluído com sucesso.")
    return paths
