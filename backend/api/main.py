from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from backend.api.routes import interviews, niches, config
from backend.core.config import settings
from backend.services.llm_client import _resolve_model
from backend.storage.filesystem import interview_path

app = FastAPI(title="Crivo Insights API", version="1.0.0")

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


# ── Auth simples por Bearer token ──────────────────────────────────────────────

def verify_token(request: Request):
    """
    Valida API_SECRET_KEY no header Authorization: Bearer <key>.

    Aceita também via query param `?token=<key>` para suportar tags
    <audio>/<video>, que não permitem header customizado. O token na URL
    é OK pra esse uso interno (ngrok privado, sem CDN público).
    """
    if not settings.api_secret_key:
        return  # sem chave configurada = sem proteção (dev local)

    # 1) Header Authorization
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and auth[7:] == settings.api_secret_key:
        return

    # 2) Query param ?token=...
    if request.query_params.get("token") == settings.api_secret_key:
        return

    raise HTTPException(status_code=401, detail="Token inválido ou ausente.")


# ── Rotas ──────────────────────────────────────────────────────────────────────

app.include_router(interviews.router)
app.include_router(niches.router)
app.include_router(config.router)


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


# ── Servir mídia (áudio/vídeo) ────────────────────────────────────────────────
# Mapa de MIME por extensão. Inclui formatos do raw original (preservados sem
# transcoding) + os WAVs gerados pelo pipeline.

_MIME_MAP = {
    # Áudio
    ".wav":  "audio/wav",
    ".mp3":  "audio/mpeg",
    ".m4a":  "audio/mp4",
    ".aac":  "audio/aac",
    ".ogg":  "audio/ogg",
    ".oga":  "audio/ogg",
    ".flac": "audio/flac",
    ".opus": "audio/opus",
    # Vídeo
    ".mp4":  "video/mp4",
    ".m4v":  "video/mp4",
    ".mkv":  "video/x-matroska",
    ".mov":  "video/quicktime",
    ".avi":  "video/x-msvideo",
    ".webm": "video/webm",
}

# Ordem de busca por subpasta. processed/ vem primeiro (mais comum no player)
# mas raw/ é onde fica o arquivo original com fidelidade total.
_MEDIA_SEARCH_DIRS = ("processed", "raw", "parts")


def _file_range_generator(path: str, start: int, end: int, chunk: int = 65536):
    """
    Gera chunks do arquivo entre os bytes [start, end] inclusive.
    Usado pelo StreamingResponse para suportar Range requests (206 Partial Content).
    Necessário porque Starlette 0.36.x não implementa Range no FileResponse.
    """
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@app.get("/media/{niche}/{interview}/{filename}")
def serve_media(
    request: Request,
    niche: str,
    interview: str,
    filename: str,
    _: None = Depends(verify_token),
):
    """
    Stream de arquivos de mídia (áudio/vídeo) das subpastas processed/raw/parts.

    Implementa Range requests manualmente (Starlette 0.36.x não tem suporte nativo).
    Sem Range → 200 com Accept-Ranges: bytes (anuncia suporte ao browser).
    Com Range → 206 Partial Content com Content-Range correto.
    Necessário para: seek em vídeos longos, duração correta, preload="metadata".
    """
    base = interview_path(niche, interview)
    if not base.exists():
        raise HTTPException(404, f"Entrevista '{interview}' não encontrada.")

    found: Path | None = None
    for subdir in _MEDIA_SEARCH_DIRS:
        candidate = base / subdir / filename
        if candidate.exists() and candidate.is_file():
            found = candidate
            break

    if found is None:
        raise HTTPException(
            404,
            f"Arquivo '{filename}' não encontrado para {niche}/{interview} "
            f"(buscado em: {', '.join(_MEDIA_SEARCH_DIRS)}).",
        )

    ext        = found.suffix.lower()
    media_type = _MIME_MAP.get(ext, "application/octet-stream")
    file_size  = found.stat().st_size
    range_header = request.headers.get("range")

    # ── Sem Range: retornar arquivo completo anunciando suporte ──────────────
    if not range_header:
        return FileResponse(
            path=str(found),
            media_type=media_type,
            content_disposition_type="inline",
            headers={"Accept-Ranges": "bytes"},
        )

    # ── Com Range: parsear e retornar 206 Partial Content ────────────────────
    try:
        raw = range_header.strip()
        if not raw.startswith("bytes="):
            raise ValueError("unit inválida")
        parts = raw[6:].split("-", 1)
        start = int(parts[0]) if parts[0] else 0
        end   = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
    except (ValueError, IndexError):
        raise HTTPException(416, "Range inválido.")

    end = min(end, file_size - 1)
    if start > end or start >= file_size:
        raise HTTPException(416, "Range Not Satisfiable.")

    chunk_length = end - start + 1
    return StreamingResponse(
        _file_range_generator(str(found), start, end),
        status_code=206,
        media_type=media_type,
        headers={
            "Content-Range":     f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges":     "bytes",
            "Content-Length":    str(chunk_length),
            "Content-Disposition": "inline",
        },
    )
