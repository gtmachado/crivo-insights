"""Estrutura a transcrição refinada e extrai insights + classificação de dores."""
from backend.services import prompt_store
from backend.services.llm_client import call


def structure_interview(refined_text: str, interview_name: str, niche: str) -> str:
    system_prompt = prompt_store.load("structure")
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
