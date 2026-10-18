import json
import threading
from pathlib import Path

import pytest

from backend.core import pipeline
from backend.core.config import settings
from backend.core.layout import DOCS, LLM_TASKS
from backend.services import llm_client, model_config
from backend.services.jobs import JobStore
from backend.storage.filesystem import write_text_atomic


# ── Layout × pipeline.py (intocável) ──────────────────────────────────────────

def test_layout_continua_alinhado_com_os_literais_do_pipeline():
    source = Path(pipeline.__file__).read_text(encoding="utf-8")
    for subdir, filename in DOCS.values():
        assert f'"{subdir}" / "{filename}"' in source, f"{subdir}/{filename} divergiu do pipeline.py"


# ── JobStore ──────────────────────────────────────────────────────────────────

def test_jobstore_get_devolve_copia():
    store = JobStore()
    job_id = store.create(log=[])
    snapshot = store.get(job_id)
    snapshot["log"].append("mutou fora do lock")
    assert store.get(job_id)["log"] == []


def test_jobstore_mutate_e_job_inexistente():
    store = JobStore()
    job_id = store.create(log=[])
    store.mutate(job_id, lambda job: job["log"].append("x"))
    store.mutate("nao-existe", lambda job: pytest.fail("não deveria chamar"))
    assert store.get(job_id)["log"] == ["x"]
    assert store.get("nao-existe") is None


def test_jobstore_descarta_finalizados_mas_nunca_os_em_execucao():
    store = JobStore(max_jobs=3)
    running = store.create()
    done = [store.create() for _ in range(2)]
    for jid in done:
        store.mutate(jid, lambda job: job.update(status="done"))
    store.create()  # 4º job → estoura o limite

    ids = {jid for jid, _ in store.items()}
    assert running in ids
    assert done[0] not in ids  # o finalizado mais antigo saiu
    assert len(ids) == 3


def test_jobstore_mutate_concorrente():
    store = JobStore()
    job_id = store.create(count=0)

    def work():
        for _ in range(500):
            store.mutate(job_id, lambda job: job.update(count=job["count"] + 1))

    threads = [threading.Thread(target=work) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert store.get(job_id)["count"] == 2000


# ── Escrita atômica ───────────────────────────────────────────────────────────

def test_write_text_atomic_cria_pastas_e_nao_deixa_temporarios(tmp_path):
    target = tmp_path / "a" / "b" / "doc.md"
    write_text_atomic(target, "um")
    write_text_atomic(target, "dois ✓")
    assert target.read_text(encoding="utf-8") == "dois ✓"
    assert [p.name for p in target.parent.iterdir()] == ["doc.md"]


# ── Resolução de modelo ───────────────────────────────────────────────────────

def test_resolve_model_prioridade_ui_depois_env_depois_default(monkeypatch, data_dir):
    monkeypatch.setattr(settings, "llm_provider", "openrouter")
    assert llm_client.resolve_model("refine") == "anthropic/claude-sonnet-4.6"

    monkeypatch.setattr(settings, "model_refine", "openai/gpt-4o")
    assert llm_client.resolve_model("refine") == "openai/gpt-4o"

    model_config.write_saved({"refine": "openai/gpt-4o-mini"})
    assert llm_client.resolve_model("refine") == "openai/gpt-4o-mini"


def test_resolve_model_default_por_provider(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    assert llm_client.resolve_model("glossary") == "claude-sonnet-4-6"
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    assert llm_client.resolve_model("glossary") == "gemini-2.0-flash"


def test_resolve_model_tarefa_desconhecida():
    with pytest.raises(ValueError):
        llm_client.resolve_model("consolidate")


# ── model_config ──────────────────────────────────────────────────────────────

def test_model_config_ignora_chaves_legadas_do_arquivo(data_dir):
    path = data_dir.parent / "config" / "models.json"
    path.parent.mkdir()
    path.write_text(json.dumps({"refine": "openai/gpt-4o", "consolidate": "x"}), encoding="utf-8")
    assert model_config.read_saved() == {"refine": "openai/gpt-4o"}


def test_model_config_json_corrompido_vira_vazio(data_dir):
    path = data_dir.parent / "config" / "models.json"
    path.parent.mkdir()
    path.write_text("{quebrado", encoding="utf-8")
    assert model_config.read_saved() == {}


def test_model_config_valida_allowlist():
    with pytest.raises(ValueError):
        model_config.write_saved({"refine": "anthropic/claude-opus-9"})
    assert set(LLM_TASKS) == {"refine", "structure", "glossary"}


# ── llm_client: dispatch e validação ──────────────────────────────────────────

def test_call_levanta_runtimeerror_com_contexto(monkeypatch):
    def boom(model, system_prompt, user_content):
        raise EnvironmentError("sem chave")

    monkeypatch.setitem(llm_client._PROVIDERS, "openrouter", boom)
    monkeypatch.setattr(settings, "llm_provider", "openrouter")
    with pytest.raises(RuntimeError, match="(?s)etapa 'refine'.*sem chave"):
        llm_client.call("refine", "sys", "user")


def test_resposta_vazia_e_erro(monkeypatch):
    monkeypatch.setitem(llm_client._PROVIDERS, "openrouter", lambda m, s, u: "   ")
    with pytest.raises(RuntimeError, match="vazia"):
        llm_client.call_with_model("openrouter", "m", "sys", "user")


def test_call_with_model_ignora_provider_global_e_retorna_texto(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setitem(llm_client._PROVIDERS, "anthropic", lambda m, s, u: f" {m}|{u} ")
    assert llm_client.call_with_model("anthropic", "claude-x", "sys", "oi") == "claude-x|oi"


def test_provider_desconhecido():
    with pytest.raises(ValueError, match="Provider desconhecido"):
        llm_client.call_with_model("nope", "m", "s", "u")
