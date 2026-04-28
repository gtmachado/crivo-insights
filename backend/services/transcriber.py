"""Transcreve arquivos WAV usando Whisper local."""
from pathlib import Path
from functools import lru_cache

from backend.core.config import settings


@lru_cache(maxsize=1)
def _load_model():
    import whisper  # import lazy: evita falha em ambientes sem whisper/torch
    return whisper.load_model(settings.whisper_model)


def transcribe_file(wav_path: Path) -> str:
    model = _load_model()
    result = model.transcribe(str(wav_path), language="pt", fp16=False)
    return result["text"].strip()


def transcribe_chunks(chunks: list[Path]) -> str:
    parts: list[str] = []
    for i, chunk in enumerate(chunks, 1):
        print(f"  Transcrevendo parte {i}/{len(chunks)}: {chunk.name}")
        text = transcribe_file(chunk)
        parts.append(text)
    return "\n\n".join(parts)
