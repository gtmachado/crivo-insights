"""Configuração de modelos LLM e prompts por etapa."""
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.storage.filesystem import read_model_config, write_model_config
from backend.services.llm_client import _resolve_model

router = APIRouter(prefix="/config", tags=["config"])

# ── Prompts ────────────────────────────────────────────────────────────────────

_PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

PROMPT_FILES: dict[str, str] = {
    "refine":               "refine_prompt.md",
    "structure":            "structure_prompt.md",
    "glossary":             "glossary_prompt.md",
    "consolidate_glossary": "consolidate_glossary_prompt.md",
    "niche_analysis":       "niche_analysis.md",
}

PROMPT_LABELS: dict[str, str] = {
    "refine":               "Refinamento",
    "structure":            "Estruturação",
    "glossary":             "Glossário",
    "consolidate_glossary": "Consolidação de Glossário",
    "niche_analysis":       "Análise de Nicho",
}


def _prompt_path(name: str) -> Path:
    return _PROMPTS_DIR / PROMPT_FILES[name]


def _default_path(name: str) -> Path:
    return _PROMPTS_DIR / "_defaults" / PROMPT_FILES[name]


def _backup_path(name: str) -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return _PROMPTS_DIR / "_backups" / f"{name}-{ts}.md"


def _capture_default(name: str) -> None:
    """Copia o prompt atual para _defaults/ na primeira modificação (uma vez só)."""
    dst = _default_path(name)
    if not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(_prompt_path(name).read_text(encoding="utf-8"), encoding="utf-8")


class PromptUpdate(BaseModel):
    content: str

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


@router.get("/prompts")
def list_prompts():
    """Lista todos os prompts editáveis com metadados."""
    return [
        {
            "name":        name,
            "label":       PROMPT_LABELS[name],
            "filename":    PROMPT_FILES[name],
            "has_default": _default_path(name).exists(),
        }
        for name in PROMPT_FILES
    ]


@router.get("/prompts/{prompt_name}")
def get_prompt(prompt_name: str):
    """Retorna o conteúdo atual de um prompt."""
    if prompt_name not in PROMPT_FILES:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_name}' não encontrado.")
    return {
        "name":        prompt_name,
        "content":     _prompt_path(prompt_name).read_text(encoding="utf-8"),
        "has_default": _default_path(prompt_name).exists(),
    }


@router.put("/prompts/{prompt_name}")
def update_prompt(prompt_name: str, body: PromptUpdate):
    """Salva novo conteúdo para um prompt. Cria backup antes de sobrescrever."""
    if prompt_name not in PROMPT_FILES:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_name}' não encontrado.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Conteúdo do prompt não pode ser vazio.")

    # Captura o default original na primeira modificação
    _capture_default(prompt_name)

    # Backup timestamped do estado atual
    backup = _backup_path(prompt_name)
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(_prompt_path(prompt_name).read_text(encoding="utf-8"), encoding="utf-8")

    _prompt_path(prompt_name).write_text(body.content, encoding="utf-8")
    return {"ok": True}


@router.post("/prompts/{prompt_name}/restore")
def restore_prompt(prompt_name: str):
    """Restaura o prompt ao estado padrão (capturado na primeira edição)."""
    if prompt_name not in PROMPT_FILES:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_name}' não encontrado.")

    default = _default_path(prompt_name)
    if not default.exists():
        raise HTTPException(
            status_code=409,
            detail="Prompt ainda não foi modificado — já está no estado padrão.",
        )

    # Backup do estado atual antes de restaurar
    backup = _backup_path(prompt_name)
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(_prompt_path(prompt_name).read_text(encoding="utf-8"), encoding="utf-8")

    _prompt_path(prompt_name).write_text(default.read_text(encoding="utf-8"), encoding="utf-8")
    return {"ok": True, "restored": True}


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
