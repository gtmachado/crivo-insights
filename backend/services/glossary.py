"""Gera glossário de termos-chave do nicho a partir da transcrição refinada."""
from backend.services import prompt_store
from backend.services.llm_client import call


def generate_glossary(refined_text: str, niche: str) -> str:
    system_prompt = prompt_store.load("glossary")
    user_content = f"Nicho: {niche}\n\n---TRANSCRIÇÃO REFINADA---\n{refined_text}"
    return call(
        task="glossary",
        system_prompt=system_prompt,
        user_content=user_content,
        metadata={"niche": niche},
    )
