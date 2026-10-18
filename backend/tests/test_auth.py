import pytest

from backend.core.config import settings

PROTECTED = ["/status", "/pipeline/jobs", "/niches/", "/interviews/saude", "/config/models"]


def test_sem_chave_configurada_nao_exige_token(client):
    assert client.get("/niches/").status_code == 200


@pytest.mark.parametrize("path", PROTECTED)
def test_rotas_protegidas_exigem_token(client, monkeypatch, path):
    monkeypatch.setattr(settings, "api_secret_key", "segredo")
    assert client.get(path).status_code == 401


def test_health_continua_aberto(client, monkeypatch):
    monkeypatch.setattr(settings, "api_secret_key", "segredo")
    assert client.get("/health").status_code == 200


def test_aceita_bearer_e_query_token(client, monkeypatch):
    monkeypatch.setattr(settings, "api_secret_key", "segredo")
    assert client.get("/niches/", headers={"Authorization": "Bearer segredo"}).status_code == 200
    assert client.get("/niches/?token=segredo").status_code == 200


def test_rejeita_token_errado(client, monkeypatch):
    monkeypatch.setattr(settings, "api_secret_key", "segredo")
    assert client.get("/niches/", headers={"Authorization": "Bearer errado"}).status_code == 401
    assert client.get("/niches/?token=errado").status_code == 401


def test_midia_tambem_exige_token(client, monkeypatch, make_interview):
    make_interview(media={"processed/audio.wav": b"x" * 10})
    monkeypatch.setattr(settings, "api_secret_key", "segredo")
    assert client.get("/media/saude/ent-01/audio.wav").status_code == 401
    assert client.get("/media/saude/ent-01/audio.wav?token=segredo").status_code == 200
