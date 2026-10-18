import shutil
from pathlib import Path

import pytest

from backend.services import prompt_store
from backend.api.routes import niches


# ── Nichos ────────────────────────────────────────────────────────────────────

def test_lista_nichos_ignora_pastas_privadas(client, data_dir):
    for name in ("saude", "varejo", "_tmp", ".git"):
        (data_dir / name).mkdir()
    assert client.get("/niches/").json() == ["saude", "varejo"]


def test_get_analise_inexistente_404_sem_criar_pastas(client, data_dir):
    assert client.get("/niches/fantasma/analysis").status_code == 404
    assert list(data_dir.iterdir()) == []


def test_analyze_exige_ao_menos_uma_entrevista(client):
    assert client.post("/niches/saude/analyze", json={"interviews": []}).status_code == 422


def test_analyze_ciclo_completo(client, make_interview, monkeypatch):
    from backend.storage.filesystem import niche_analysis_path, save_markdown

    def fake_analyze(niche, slugs):
        path = niche_analysis_path(niche)
        save_markdown(path, "# Análise")
        return path

    monkeypatch.setattr(niches, "analyze_niche", fake_analyze)
    make_interview()

    r = client.post("/niches/saude/analyze", json={"interviews": ["ent-01"]})
    job = client.get(f"/niches/saude/analyze/status/{r.json()['job_id']}").json()
    assert job["status"] == "done"
    assert client.get("/niches/saude/analysis").json() == {"content": "# Análise"}


def test_analyze_erro_vai_para_o_job(client, monkeypatch):
    def boom(niche, slugs):
        raise RuntimeError("sem chave")

    monkeypatch.setattr(niches, "analyze_niche", boom)
    r = client.post("/niches/saude/analyze", json={"interviews": ["x"]})
    job = client.get(f"/niches/saude/analyze/status/{r.json()['job_id']}").json()
    assert job["status"] == "error" and job["log"] == ["sem chave"]


def test_endpoints_de_consolidacao_legada_foram_removidos(client):
    assert client.post("/niches/saude/consolidate/insights").status_code in (404, 405)
    assert client.get("/niches/saude/insights").status_code == 404
    assert client.get("/niches/saude/glossary").status_code == 404


# ── Config de modelos ─────────────────────────────────────────────────────────

def test_modelos_salvar_e_ler(client, data_dir):
    r = client.put("/config/models", json={"refine": "openai/gpt-4o-mini"})
    assert r.status_code == 200
    body = client.get("/config/models").json()
    assert body["saved"] == {"refine": "openai/gpt-4o-mini"}
    assert body["effective"]["refine"] == "openai/gpt-4o-mini"
    assert set(body["effective"]) == {"refine", "structure", "glossary"}


def test_modelos_rejeita_fora_da_allowlist(client):
    r = client.put("/config/models", json={"refine": "anthropic/claude-opus-9"})
    assert r.status_code == 400


def test_modelos_vazio_remove_override(client):
    client.put("/config/models", json={"refine": "openai/gpt-4o"})
    client.put("/config/models", json={"refine": ""})
    assert client.get("/config/models").json()["saved"] == {}


# ── Prompts (em cópia temporária — nunca toca backend/prompts) ────────────────

@pytest.fixture
def prompts_dir(tmp_path, monkeypatch):
    real = Path(prompt_store.PROMPTS_DIR)
    copy = tmp_path / "prompts"
    copy.mkdir()
    for f in real.glob("*.md"):
        shutil.copy(f, copy / f.name)
    monkeypatch.setattr(prompt_store, "PROMPTS_DIR", copy)
    return copy


def test_lista_de_prompts_nao_inclui_consolidacao(client, prompts_dir):
    names = [p["name"] for p in client.get("/config/prompts").json()]
    assert names == ["refine", "structure", "glossary", "niche_analysis"]


def test_prompt_editar_e_restaurar(client, prompts_dir):
    original = client.get("/config/prompts/refine").json()["content"]

    assert client.put("/config/prompts/refine", json={"content": "novo"}).status_code == 200
    assert client.get("/config/prompts/refine").json()["content"] == "novo"
    assert len(list((prompts_dir / "_backups").iterdir())) == 1

    assert client.post("/config/prompts/refine/restore").status_code == 200
    assert client.get("/config/prompts/refine").json()["content"] == original


def test_prompt_vazio_ou_desconhecido(client, prompts_dir):
    assert client.put("/config/prompts/refine", json={"content": "  "}).status_code == 400
    assert client.get("/config/prompts/inexistente").status_code == 404
    assert client.post("/config/prompts/glossary/restore").status_code == 409


def test_openapi_documenta_todas_as_rotas(client):
    schema = client.get("/openapi.json").json()
    assert "/interviews/upload" in schema["paths"]
    assert "/niches/{niche}/analyze" in schema["paths"]
    assert not any("consolidate" in p for p in schema["paths"])
