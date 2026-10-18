"""Configuração de modelos LLM e prompts por etapa."""
from fastapi import APIRouter, HTTPException

from backend.api.schemas import (
    ModelConfig,
    ModelConfigUpdate,
    Ok,
    PromptContent,
    PromptInfo,
    PromptRestored,
    PromptUpdate,
)
from backend.core.layout import LLM_TASKS, NICHE_ANALYSIS_MODEL_OPENROUTER
from backend.services import model_config, prompt_store
from backend.services.llm_client import resolve_model

router = APIRouter(prefix="/config", tags=["config"])


# ── Modelos ───────────────────────────────────────────────────────────────────

@router.get("/models", response_model=ModelConfig)
def get_model_config():
    """
    - saved:          overrides salvos em data/config/models.json
    - effective:      modelo efetivamente usado em runtime por etapa
    - allowed_models: opções permitidas no dropdown
    - fixed:          etapas não configuráveis (niche_analysis)
    """
    return ModelConfig(
        saved=model_config.read_saved(),
        effective={task: resolve_model(task) for task in LLM_TASKS},
        allowed_models=model_config.ALLOWED_MODELS,
        fixed={"niche_analysis": NICHE_ANALYSIS_MODEL_OPENROUTER},
    )


@router.put("/models", response_model=Ok)
def update_model_config(body: ModelConfigUpdate):
    """Salva overrides de modelo. Valores vazios removem o override (volta ao default)."""
    try:
        model_config.write_saved(body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Ok()


# ── Prompts ───────────────────────────────────────────────────────────────────

def _known(name: str) -> str:
    if name not in prompt_store.PROMPTS:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' não encontrado.")
    return name


@router.get("/prompts", response_model=list[PromptInfo])
def list_prompts():
    return prompt_store.listing()


@router.get("/prompts/{prompt_name}", response_model=PromptContent)
def get_prompt(prompt_name: str):
    name = _known(prompt_name)
    return PromptContent(
        name=name,
        content=prompt_store.load(name),
        has_default=prompt_store.has_default(name),
    )


@router.put("/prompts/{prompt_name}", response_model=Ok)
def update_prompt(prompt_name: str, body: PromptUpdate):
    """Salva novo conteúdo. Captura o padrão na 1ª edição e faz backup antes de sobrescrever."""
    name = _known(prompt_name)
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Conteúdo do prompt não pode ser vazio.")
    prompt_store.save(name, body.content)
    return Ok()


@router.post("/prompts/{prompt_name}/restore", response_model=PromptRestored)
def restore_prompt(prompt_name: str):
    """Restaura o prompt ao estado padrão (capturado na primeira edição)."""
    name = _known(prompt_name)
    try:
        prompt_store.restore(name)
    except prompt_store.NoDefaultPrompt:
        raise HTTPException(
            status_code=409,
            detail="Prompt ainda não foi modificado — já está no estado padrão.",
        )
    return PromptRestored()
