import pytest

from backend.api.routes.media import parse_range

DATA = bytes(range(100))


@pytest.mark.parametrize(
    "header,expected",
    [
        ("bytes=0-9", (0, 9)),
        ("bytes=10-", (10, 99)),
        ("bytes=-5", (95, 99)),       # sufixo: últimos 5 bytes
        ("bytes=-500", (0, 99)),      # sufixo maior que o arquivo
        ("bytes=90-500", (90, 99)),   # end além do arquivo é truncado
    ],
)
def test_parse_range_valido(header, expected):
    assert parse_range(header, 100) == expected


@pytest.mark.parametrize(
    "header",
    ["items=0-9", "bytes=100-", "bytes=50-10", "bytes=a-b", "bytes=0-4,10-14", "bytes=", "bytes=-0"],
)
def test_parse_range_invalido(header):
    with pytest.raises(ValueError):
        parse_range(header, 100)


@pytest.fixture
def media(make_interview):
    make_interview(media={"processed/audio.wav": DATA, "raw/original.mp3": b"mp3"})


def test_sem_range_anuncia_suporte(client, media):
    r = client.get("/media/saude/ent-01/audio.wav")
    assert r.status_code == 200
    assert r.headers["accept-ranges"] == "bytes"
    assert r.content == DATA


def test_range_devolve_206(client, media):
    r = client.get("/media/saude/ent-01/audio.wav", headers={"Range": "bytes=10-19"})
    assert r.status_code == 206
    assert r.headers["content-range"] == "bytes 10-19/100"
    assert r.content == DATA[10:20]


def test_range_de_sufixo(client, media):
    r = client.get("/media/saude/ent-01/audio.wav", headers={"Range": "bytes=-5"})
    assert r.status_code == 206
    assert r.content == DATA[-5:]


def test_range_fora_do_arquivo_416(client, media):
    r = client.get("/media/saude/ent-01/audio.wav", headers={"Range": "bytes=500-"})
    assert r.status_code == 416


def test_procura_tambem_em_raw(client, media):
    assert client.get("/media/saude/ent-01/original.mp3").content == b"mp3"


def test_arquivo_inexistente_404(client, media):
    assert client.get("/media/saude/ent-01/nao-existe.wav").status_code == 404
    assert client.get("/media/saude/outra/audio.wav").status_code == 404


@pytest.mark.parametrize(
    "filename",
    ["..%5Cmetadata.json", "..%2Fmetadata.json", "%2e%2e%2f%2e%2e%2fmetadata.json", "..%5C..%5Cmetadata.json"],
)
def test_path_traversal_bloqueado(client, make_interview, filename):
    base = make_interview(media={"processed/audio.wav": DATA})
    # Arquivo real FORA das subpastas de mídia: o teste só vale se ele existir.
    (base / "metadata.json").write_text("{}", encoding="utf-8")
    assert client.get(f"/media/saude/ent-01/{filename}").status_code == 404
