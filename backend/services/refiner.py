"""Refina a transcrição bruta corrigindo gramática sem alterar conteúdo."""
from pathlib import Path

from backend.services.llm_client import call

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "refine_prompt.md"
_CHUNK_CHARS = 12_000  # ~3k tokens — divide se a transcrição for muito longa


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


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


def refine_transcription(raw_text: str) -> str:
    system_prompt = _load_prompt()
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
