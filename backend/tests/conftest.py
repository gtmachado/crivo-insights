"""Fixtures: toda I/O de disco vai para um diretório temporário (nunca data/)."""
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.routes import interviews, niches
from backend.core.config import settings


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    path = tmp_path / "niches"
    path.mkdir()
    monkeypatch.setattr(settings, "data_dir", path)
    monkeypatch.setattr(settings, "api_secret_key", None)
    interviews.jobs.clear()
    niches.jobs.clear()
    return path


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def make_interview(data_dir):
    """Cria uma entrevista com os docs informados e devolve sua pasta."""
    from backend.storage.filesystem import interview_dir, save_markdown

    def _make(niche="saude", name="ent-01", outputs=None, media=None):
        base = interview_dir(niche, name)
        for rel, content in (outputs or {}).items():
            save_markdown(base / rel, content)
        for rel, data in (media or {}).items():
            (base / rel).write_bytes(data)
        return base

    return _make
