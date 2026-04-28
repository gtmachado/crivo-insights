"""Estrutura a transcrição refinada e extrai insights + classificação de dores."""
from pathlib import Path

from backend.services.llm_client import call

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "structure_prompt.md"


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def structure_interview(refined_text: str, interview_name: str, niche: str) -> str:
    system_prompt = _load_prompt()
    user_content = (
        f"Nicho: {niche}\n"
        f"Entrevista: {interview_name}\n\n"
        f"---TRANSCRIÇÃO REFINADA---\n{refined_text}"
    )
    return call(
        task="structure",
        system_prompt=system_prompt,
        user_content=user_content,
        metadata={"niche": niche, "interview": interview_name},
    )
