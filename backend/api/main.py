from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.api.routes import interviews, niches
from backend.core.config import settings
from backend.services.llm_client import _resolve_model
from backend.storage.filesystem import interview_dir

app = FastAPI(title="Crivo Insights API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth simples por Bearer token ──────────────────────────────────────────────

def verify_token(request: Request):
    """Valida API_SECRET_KEY no header Authorization: Bearer <key>."""
    if not settings.api_secret_key:
        return  # sem chave configurada = sem proteção (dev local)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != settings.api_secret_key:
        raise HTTPException(status_code=401, detail="Token inválido ou ausente.")


# ── Rotas ──────────────────────────────────────────────────────────────────────

app.include_router(interviews.router)
app.include_router(niches.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status")
def system_status():
    tasks = ["refine", "glossary", "structure", "consolidate", "consolidate_glossary"]
    return {
        "llm_provider": settings.llm_provider,
        "api_key_configured": bool(settings.active_api_key()),
        "whisper_model": settings.whisper_model,
        "data_dir": str(settings.data_dir),
        "models": {task: _resolve_model(task) for task in tasks},
    }


@app.get("/pipeline/jobs")
def list_all_jobs():
    """Retorna todos os jobs em memória (dashboard)."""
    from backend.api.routes.interviews import _jobs
    result = []
    for job_id, job in _jobs.items():
        result.append({
            "job_id": job_id,
            "niche": job.get("niche", ""),
            "interview": job.get("interview", ""),
            **job,
        })
    return result


@app.get("/media/{niche}/{interview}/{filename}")
def serve_media(
    niche: str,
    interview: str,
    filename: str,
    _: None = Depends(verify_token),
):
    """Stream de arquivos de mídia (áudio/vídeo) da pasta processed/ ou raw/."""
    base = interview_dir(niche, interview)
    # Procura em processed/ primeiro, depois raw/
    for subdir in ("processed", "raw", "parts"):
        candidate = base / subdir / filename
        if candidate.exists():
            return FileResponse(
                path=str(candidate),
                media_type="audio/wav" if filename.endswith(".wav") else "application/octet-stream",
                filename=filename,
            )
    raise HTTPException(404, f"Arquivo '{filename}' não encontrado para {niche}/{interview}.")
