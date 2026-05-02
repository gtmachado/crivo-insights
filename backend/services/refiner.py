"""Refina a transcrição bruta formatando como diálogo com separação de participantes."""
from pathlib import Path

from backend.services.llm_client import call
from backend.storage.filesystem import read_meta

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "refine_prompt.md"
_CHUNK_CHARS = 12_000  # ~3k tokens — divide se a transcrição for muito longa


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def _build_context_header(niche: str | None, interview_name: str | None) -> str:
    """Monta cabeçalho de contexto com nomes reais do metadata.json, se disponíveis."""
    if not niche or not interview_name:
        return ""

    meta = read_meta(niche, interview_name)
    if not meta:
        return ""

    interviewer = meta.get("interviewer_name", "").strip()
    interviewee = meta.get("interviewee_name", "").strip()

    if not interviewer and not interviewee:
        return ""

    lines = ["## Contexto da entrevista\n"]
    if interviewer:
        lines.append(f"- **Entrevistador:** {interviewer}")
    if interviewee:
        lines.append(f"- **Entrevistado:** {interviewee}")
    lines.append(
        "\nUse esses nomes reais nas marcações de falante (ex: **"
        + (interviewer or "Entrevistador")
        + ":** e **"
        + (interviewee or "Entrevistado")
        + ":**).\n\n---\n"
    )
    return "\n".join(lines) + "\n"


def _split_text(text: str, chunk_size: int) -> list[str]:
    paragraphs = text.split("\n\n")
    chunks, current = [], ""
    for p in paragraphs:
        if len(current) + len(p) > chunk_size and current:
            chunks.append(current.strip())
            current = p + "\n\n"
        else:
            current += p + "\n\n"
    if current.strip():
        chunks.append(current.strip())
    return chunks or [text]


def refine_transcription(
    raw_text: str,
    niche: str | None = None,
    interview_name: str | None = None,
) -> str:
    base_prompt = _load_prompt()
    context_header = _build_context_header(niche, interview_name)
    system_prompt = context_header + base_prompt if context_header else base_prompt

    chunks = _split_text(raw_text, _CHUNK_CHARS)
    refined_parts: list[str] = []

    for i, chunk in enumerate(chunks, 1):
        if len(chunks) > 1:
            print(f"  Refinando chunk {i}/{len(chunks)}...")
        result = call(
            task="refine",
            system_prompt=system_prompt,
            user_content=chunk,
            metadata={"chunk": f"{i}/{len(chunks)}"},
        )
        refined_parts.append(result)

    return "\n\n".join(refined_parts)
