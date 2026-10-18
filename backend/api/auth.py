"""Autenticação simples por token (Bearer ou ?token=)."""
import hmac

from fastapi import HTTPException, Request

from backend.core.config import settings


def _matches(candidate: str, secret: str) -> bool:
    return hmac.compare_digest(candidate.encode("utf-8"), secret.encode("utf-8"))


def verify_token(request: Request) -> None:
    """
    Valida API_SECRET_KEY no header `Authorization: Bearer <key>`.

    Aceita também `?token=<key>` para suportar tags <audio>/<video>, que não
    permitem header customizado. O token na URL é aceitável para este uso
    interno (ngrok privado, sem CDN público).

    Sem chave configurada = sem proteção (dev local).
    """
    secret = settings.api_secret_key
    if not secret:
        return

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and _matches(auth[7:], secret):
        return

    token = request.query_params.get("token")
    if token and _matches(token, secret):
        return

    raise HTTPException(status_code=401, detail="Token inválido ou ausente.")
