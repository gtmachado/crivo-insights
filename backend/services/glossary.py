"""Gera glossário de termos-chave do nicho a partir da transcrição refinada."""
from pathlib import Path

from backend.services.llm_client import call

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "glossary_prompt.md"


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def generate_glossary(refined_text: str, niche: str) -> str:
    system_prompt = _load_prompt()
    user_content = f"Nicho: {niche}\n\n---TRANSCRIÇÃO REFINADA---\n{refined_text}"
    return call(
        task="glossary",
        system_prompt=system_prompt,
        user_content=user_content,
        metadata={"niche": niche},
    )
