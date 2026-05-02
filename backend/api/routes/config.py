"""Configuração de modelos LLM por etapa — GET/PUT /config/models."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.storage.filesystem import read_model_config, write_model_config
from backend.services.llm_client import _resolve_model

router = APIRouter(prefix="/config", tags=["config"])

# Tarefas configuráveis via UI (niche_analysis é sempre fixo)
CONFIGURABLE_TASKS = ["refine", "structure", "glossary", "consolidate", "consolidate_glossary"]

# Modelos oferecidos no dropdown — sem Opus
ALLOWED_MODELS = [
    "anthropic/claude-sonnet-4.6",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
]


class ModelConfigUpdate(BaseModel):
    refine: str = ""
    structure: str = ""
    glossary: str = ""
    consolidate: str = ""
    consolidate_glossary: str = ""


@router.get("/models")
def get_model_config():
    """
    Retorna:
    - saved:          overrides salvos em data/config/models.json
    - effective:      modelo que será efetivamente usado em runtime por etapa
    - allowed_models: lista de opções permitidas no dropdown
    - fixed:          etapas não configuráveis (niche_analysis)
    """
    return {
        "saved":          read_model_config(),
        "effective":      {task: _resolve_model(task) for task in CONFIGURABLE_TASKS},
        "allowed_models": ALLOWED_MODELS,
        "fixed":          {"niche_analysis": "anthropic/claude-sonnet-4.6"},
    }


@router.put("/models")
def update_model_config(body: ModelConfigUpdate):
    """
    Salva overrides de modelo em data/config/models.json.
    Valores vazios removem o override da tarefa (volta ao default do código/.env).
    """
    data = body.model_dump()

    # Validar: só aceitar modelos da allowlist ou string vazia (reset)
    for task, model in data.items():
        if model and model not in ALLOWED_MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Modelo '{model}' não é permitido para '{task}'. "
                       f"Opções: {', '.join(ALLOWED_MODELS)}",
            )

    # Só persistir valores não-vazios (vazio = remover override = usar default)
    cleaned = {task: model for task, model in data.items() if model}
    write_model_config(cleaned)
    return {"ok": True}
