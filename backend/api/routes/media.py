"""Streaming de mídia (áudio/vídeo) com suporte a HTTP Range."""
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from backend.storage.filesystem import interview_path

router = APIRouter(tags=["media"])

# Mapa de MIME por extensão. Inclui formatos do raw original (preservados sem
# transcoding) + os WAVs gerados pelo pipeline.
MIME_MAP = {
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

# processed/ vem primeiro (mais comum no player); raw/ guarda o original.
MEDIA_SEARCH_DIRS = ("processed", "raw", "parts")


def parse_range(header: str, size: int) -> tuple[int, int]:
    """
    Converte um header `Range: bytes=...` em (start, end) inclusivos.
    Suporta `a-b`, `a-` e o sufixo `-n` (últimos n bytes).
    Levanta ValueError se inválido, multi-range ou fora do arquivo.
    """
    unit, _, spec = header.strip().partition("=")
    spec = spec.strip()
    if unit.strip().lower() != "bytes" or "," in spec:
        raise ValueError("range não suportado")

    start_s, sep, end_s = spec.partition("-")
    if not sep:
        raise ValueError("range sem hífen")

    if start_s == "":  # sufixo: bytes=-500
        count = int(end_s)
        if count <= 0:
            raise ValueError("sufixo inválido")
        start, end = max(size - count, 0), size - 1
    else:
        start = int(start_s)
        end = int(end_s) if end_s else size - 1

    end = min(end, size - 1)
    if start < 0 or start > end or start >= size:
        raise ValueError("range fora do arquivo")
    return start, end


def find_media_file(base: Path, filename: str) -> Path | None:
    """
    Procura `filename` nas subpastas de mídia da entrevista, garantindo que o
    caminho resolvido não escape da subpasta (path traversal).
    """
    for subdir in MEDIA_SEARCH_DIRS:
        root = (base / subdir).resolve()
        candidate = (root / filename).resolve()
        if candidate.is_relative_to(root) and candidate.is_file():
            return candidate
    return None


def _iter_range(path: Path, start: int, end: int, chunk: int = 65536):
    """Gera chunks do arquivo entre os bytes [start, end] inclusive."""
    with path.open("rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@router.get("/media/{niche}/{interview}/{filename}")
def serve_media(request: Request, niche: str, interview: str, filename: str):
    """
    Stream de arquivos de mídia das subpastas processed/raw/parts.

    Sem Range → 200 com `Accept-Ranges: bytes` (anuncia suporte ao browser).
    Com Range → 206 Partial Content com `Content-Range` correto — necessário
    para seek, duração correta e `preload="metadata"`.
    """
    base = interview_path(niche, interview)
    if not base.exists():
        raise HTTPException(404, f"Entrevista '{interview}' não encontrada.")

    found = find_media_file(base, filename)
    if found is None:
        raise HTTPException(
            404,
            f"Arquivo '{filename}' não encontrado para {niche}/{interview} "
            f"(buscado em: {', '.join(MEDIA_SEARCH_DIRS)}).",
        )

    media_type = MIME_MAP.get(found.suffix.lower(), "application/octet-stream")
    file_size = found.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(
            path=str(found),
            media_type=media_type,
            content_disposition_type="inline",
            headers={"Accept-Ranges": "bytes"},
        )

    try:
        start, end = parse_range(range_header, file_size)
    except ValueError:
        raise HTTPException(
            416, "Range Not Satisfiable.", headers={"Content-Range": f"bytes */{file_size}"}
        )

    return StreamingResponse(
        _iter_range(found, start, end),
        status_code=206,
        media_type=media_type,
        headers={
            "Content-Range":       f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges":       "bytes",
            "Content-Length":      str(end - start + 1),
            "Content-Disposition": "inline",
        },
    )
