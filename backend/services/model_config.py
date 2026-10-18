"""Modelos LLM escolhidos pela UI (data/config/models.json)."""
import json
from pathlib import Path

from backend.core.config import settings
from backend.core.layout import LLM_TASKS
from backend.storage.filesystem import write_text_atomic

# Modelos oferecidos no dropdown — sem Opus.
ALLOWED_MODELS = [
    "anthropic/claude-sonnet-4.6",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
]


def _path() -> Path:
    """data/config/models.json — runtime local, não versionado."""
    return settings.data_dir.parent / "config" / "models.json"


def read_saved() -> dict[str, str]:
    """Overrides salvos pela UI, só das tarefas configuráveis. {} se não houver."""
    path = _path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {task: model for task, model in data.items() if task in LLM_TASKS and model}


def validate(overrides: dict[str, str]) -> None:
    """Levanta ValueError se algum modelo não estiver na allowlist (vazio = reset)."""
    for task, model in overrides.items():
        if model and model not in ALLOWED_MODELS:
            raise ValueError(
                f"Modelo '{model}' não é permitido para '{task}'. "
                f"Opções: {', '.join(ALLOWED_MODELS)}"
            )


def write_saved(overrides: dict[str, str]) -> dict[str, str]:
    """Valida e persiste os overrides; valores vazios removem o override."""
    validate(overrides)
    cleaned = {task: model for task, model in overrides.items() if task in LLM_TASKS and model}
    write_text_atomic(_path(), json.dumps(cleaned, ensure_ascii=False, indent=2))
    return cleaned
