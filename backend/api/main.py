from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.auth import verify_token
from backend.api.routes import config, interviews, media, niches
from backend.core.config import settings
from backend.services.llm_client import _resolve_model

app = FastAPI(title="Crivo Insights API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    # Necessário para que <audio>/<video> consigam ler os headers de range
    # responses cross-origin (Content-Range, Accept-Ranges). Sem isso o
    # browser não sabe o tamanho total do arquivo → duração = 0.
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"],
)

# Todas as rotas (exceto /health) exigem token quando API_SECRET_KEY está definida.
_protected = [Depends(verify_token)]

app.include_router(interviews.router, dependencies=_protected)
app.include_router(niches.router, dependencies=_protected)
app.include_router(config.router, dependencies=_protected)
app.include_router(media.router, dependencies=_protected)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status", dependencies=_protected)
def system_status():
    tasks = ["refine", "structure", "glossary"]
    return {
        "llm_provider": settings.llm_provider,
        "api_key_configured": bool(settings.active_api_key()),
        "whisper_model": settings.whisper_model,
        "data_dir": str(settings.data_dir),
        "models": {task: _resolve_model(task) for task in tasks},
    }


@app.get("/pipeline/jobs", dependencies=_protected)
def list_all_jobs():
    """Retorna todos os jobs em memória (dashboard)."""
    return [{"job_id": job_id, **job} for job_id, job in interviews.jobs_snapshot()]
