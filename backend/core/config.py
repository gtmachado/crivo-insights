from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    # ── Segurança ──────────────────────────────────────────────────────
    # Token simples para o frontend autenticar no backend.
    # Deixe vazio para desabilitar (só use sem proteção em dev local).
    api_secret_key: Optional[str] = None

    # ── Infra ──────────────────────────────────────────────────────────
    whisper_model: str = "base"
    audio_chunk_mb: int = 24
    data_dir: Path = Path("./data/niches")
    backend_url: str = "http://localhost:8000"

    # ── Provider principal ─────────────────────────────────────────────
    # "openrouter" | "gemini" | "anthropic"
    llm_provider: str = "openrouter"

    # ── OpenRouter ─────────────────────────────────────────────────────
    openrouter_api_key: Optional[str] = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # ── Gemini ─────────────────────────────────────────────────────────
    gemini_api_key: Optional[str] = None

    # ── Anthropic (fallback opcional) ──────────────────────────────────
    anthropic_api_key: Optional[str] = None

    # ── Modelos por tarefa ─────────────────────────────────────────────
    # Deixe vazio para usar o padrão do provider
    model_refine: str = ""
    model_structure: str = ""
    model_glossary: str = ""
    model_consolidate: str = ""
    model_consolidate_glossary: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def model_for(self, task: str) -> str:
        """Retorna o modelo configurado para a tarefa, ou string vazia (usa default do provider)."""
        return {
            "refine": self.model_refine,
            "structure": self.model_structure,
            "glossary": self.model_glossary,
            "consolidate": self.model_consolidate,
            "consolidate_glossary": self.model_consolidate_glossary,
        }.get(task, "")

    def active_api_key(self) -> Optional[str]:
        if self.llm_provider == "openrouter":
            return self.openrouter_api_key
        if self.llm_provider == "gemini":
            return self.gemini_api_key
        return self.anthropic_api_key


settings = Settings()
