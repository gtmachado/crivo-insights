import io

import pytest

from backend.api.routes import interviews
from backend.storage.filesystem import interview_path, read_meta, write_meta


@pytest.fixture
def fake_pipeline(monkeypatch):
    """Substitui o pipeline real (Whisper/LLM) por um que só emite as mensagens."""
    def run(input_file, niche, name, on_step=print):
        on_step("Preservando arquivo original em raw/...")
        on_step("Convertendo para WAV (16kHz mono)...")
        on_step("Transcrevendo com Whisper...")
        on_step("Refinando transcrição com Claude...")
        on_step("Estruturando entrevista e extraindo insights com Claude...")
        on_step("Gerando glossário local com Claude...")
        on_step("✓ Pipeline concluído com sucesso.")
        return {"original": input_file}

    monkeypatch.setattr(interviews, "run_pipeline", run)


def _upload(client, filename="ent.mp3", name="Ent 01", niche="Saúde", **extra):
    return client.post(
        "/interviews/upload",
        files={"file": (filename, io.BytesIO(b"audio"), "audio/mpeg")},
        data={"niche": niche, "interview_name": name, **extra},
    )


# ── Classificação das etapas (contrato com as mensagens do pipeline.py) ───────

@pytest.mark.parametrize(
    "msg,stage",
    [
        ("Preservando arquivo original em raw/...", "upload"),
        ("Convertendo para WAV (16kHz mono)...", "convert"),
        ("Transcrevendo com Whisper...", "transcribe"),
        ("Refinando transcrição com Claude...", "refine"),
        ("Estruturando entrevista e extraindo insights com Claude...", "structure"),
        ("Gerando glossário local com Claude...", "glossary"),
        ("Verificando tamanho do áudio...", None),
        ("✓ Pipeline concluído com sucesso.", None),
    ],
)
def test_classify_stage_com_mensagens_reais_do_pipeline(msg, stage):
    assert interviews._classify_stage(msg) == stage


# ── Upload e jobs ─────────────────────────────────────────────────────────────

def test_upload_cria_job_antes_da_task_e_conclui(client, fake_pipeline, data_dir):
    r = _upload(client)
    assert r.status_code == 200
    job_id = r.json()["job_id"]

    job = client.get(f"/interviews/status/{job_id}").json()
    assert job["status"] == "done"
    assert [s["status"] for s in job["stages"]] == ["done"] * 6
    assert job["ended_at"] is not None


def test_upload_erro_do_pipeline_marca_stage_e_job(client, monkeypatch, data_dir):
    def boom(input_file, niche, name, on_step=print):
        on_step("Preservando arquivo original em raw/...")
        on_step("Convertendo para WAV (16kHz mono)...")
        raise RuntimeError("ffmpeg quebrou")

    monkeypatch.setattr(interviews, "run_pipeline", boom)
    job = client.get(f"/interviews/status/{_upload(client).json()['job_id']}").json()
    assert job["status"] == "error"
    convert = next(s for s in job["stages"] if s["id"] == "convert")
    assert convert["status"] == "error" and "ffmpeg quebrou" in convert["error"]


def test_status_de_job_inexistente_404(client):
    assert client.get("/interviews/status/nao-existe").status_code == 404


def test_upload_formato_invalido_nao_cria_entrevista(client, data_dir):
    r = _upload(client, filename="notas.txt")
    assert r.status_code == 400
    assert list(data_dir.iterdir()) == []


def test_upload_sanitiza_nome_e_limpa_tmp(client, fake_pipeline, data_dir):
    r = _upload(client, filename="../../evil.mp3")
    assert r.status_code == 200
    meta = read_meta("Saúde", "Ent 01")
    assert meta["source_filename"] == "evil.mp3"
    # nada escapou de data_dir e o _tmp do upload foi removido
    assert not (data_dir.parent.parent / "evil.mp3").exists()
    assert list((data_dir / "_tmp").iterdir()) == []


def test_upload_grava_metadata_antes_do_pipeline(client, fake_pipeline):
    _upload(client, meta_title="Titulo", meta_interviewee_name="Maria")
    meta = read_meta("Saúde", "Ent 01")
    assert meta["title"] == "Titulo" and meta["interviewee_name"] == "Maria"
    assert meta["interview_slug"] == "ent-01"


# ── Metadata ──────────────────────────────────────────────────────────────────

def test_put_meta_parcial_preserva_campos_nao_enviados(client, make_interview):
    make_interview(niche="saude", name="ent-01")
    write_meta("saude", "ent-01", {"title": "T", "interviewee_name": "Maria", "notes": "n"})

    assert client.put("/interviews/saude/ent-01/meta", json={"notes": "novas"}).status_code == 200

    meta = client.get("/interviews/saude/ent-01/meta").json()
    assert meta["notes"] == "novas"
    assert meta["title"] == "T" and meta["interviewee_name"] == "Maria"
    assert "updated_at" in meta


def test_put_meta_permite_limpar_campo_explicitamente(client, make_interview):
    make_interview(niche="saude", name="ent-01")
    write_meta("saude", "ent-01", {"notes": "algo"})
    client.put("/interviews/saude/ent-01/meta", json={"notes": ""})
    assert client.get("/interviews/saude/ent-01/meta").json()["notes"] == ""


def test_put_meta_entrevista_inexistente_404(client):
    assert client.put("/interviews/saude/nada/meta", json={"notes": "x"}).status_code == 404


# ── Documentos ────────────────────────────────────────────────────────────────

def test_documento_ainda_nao_gerado_404(client, make_interview):
    make_interview()
    assert client.get("/interviews/saude/ent-01/structured").status_code == 404


def test_documento_invalido_400(client, make_interview):
    make_interview()
    assert client.get("/interviews/saude/ent-01/foo").status_code == 400


@pytest.mark.parametrize("doc", ["raw", "refined", "structured", "glossary"])
def test_todos_os_documentos_sao_editaveis(client, make_interview, doc):
    make_interview()
    assert client.put(f"/interviews/saude/ent-01/{doc}", json={"content": "# oi"}).status_code == 200
    assert client.get(f"/interviews/saude/ent-01/{doc}").json() == {"content": "# oi"}


def test_put_documento_em_entrevista_inexistente_nao_cria_pasta(client, data_dir):
    assert client.put("/interviews/saude/nada/raw", json={"content": "x"}).status_code == 404
    assert not interview_path("saude", "nada").exists()


# ── Listagens ─────────────────────────────────────────────────────────────────

def test_listagem_mostra_estagios_e_ignora_pastas_privadas(client, make_interview, data_dir):
    make_interview(outputs={"outputs/01_transcricao_bruta.md": "x"})
    (data_dir / "saude" / "_tmp").mkdir()
    (data_dir / "saude" / ".oculta").mkdir()
    (data_dir / "saude" / "_insights").mkdir()

    result = client.get("/interviews/saude").json()
    assert [i["name"] for i in result] == ["ent-01"]
    assert result[0]["stages"] == {"raw": True, "refined": False, "structured": False, "glossary": False}


def test_listagem_de_nicho_inexistente_vazia(client):
    assert client.get("/interviews/nada").json() == []


def test_lista_de_arquivos_e_delete(client, make_interview):
    make_interview(outputs={"outputs/01_transcricao_bruta.md": "x"})
    files = client.get("/interviews/saude/ent-01/files").json()
    assert files["outputs"][0]["name"] == "01_transcricao_bruta.md"

    assert client.delete("/interviews/saude/ent-01").status_code == 200
    assert client.get("/interviews/saude/ent-01/files").status_code == 404
    assert client.delete("/interviews/saude/ent-01").status_code == 404


def test_pipeline_jobs_lista_jobs_de_entrevista(client, fake_pipeline):
    job_id = _upload(client).json()["job_id"]
    listed = client.get("/pipeline/jobs").json()
    assert [j["job_id"] for j in listed] == [job_id]
    assert listed[0]["niche"] == "Saúde" and listed[0]["interview"] == "Ent 01"
