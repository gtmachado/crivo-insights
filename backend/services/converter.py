"""Converte vídeo/áudio para WAV e divide em chunks se necessário."""
import shutil
import struct
import subprocess
import math
from pathlib import Path

from backend.core.config import settings

SUPPORTED_INPUT = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".mp3", ".m4a", ".ogg", ".flac", ".wav"}


def _ffmpeg_available() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _wav_is_compatible(wav_path: Path) -> bool:
    """Verifica se o WAV já é 16kHz mono (compatível com Whisper)."""
    try:
        import wave
        with wave.open(str(wav_path), "rb") as f:
            return f.getnchannels() == 1 and f.getframerate() == 16000
    except Exception:
        return False


def convert_to_wav(input_path: Path, processed_dir: Path) -> Path:
    """
    Converte qualquer arquivo suportado para WAV 16kHz mono em processed/audio.wav.
    Se o arquivo já for WAV 16kHz mono, apenas copia.
    Se FFmpeg não estiver disponível e o arquivo já for WAV, copia com aviso.
    """
    processed_dir.mkdir(parents=True, exist_ok=True)
    wav_path = processed_dir / "audio.wav"

    if wav_path.exists():
        return wav_path

    suffix = input_path.suffix.lower()

    # Caso 1: arquivo já é WAV 16kHz mono → só copia, sem FFmpeg
    if suffix == ".wav" and _wav_is_compatible(input_path):
        shutil.copy2(input_path, wav_path)
        return wav_path

    # Caso 2: precisa de conversão → exige FFmpeg
    if not _ffmpeg_available():
        if suffix == ".wav":
            # WAV com formato diferente — copia mesmo assim e avisa
            print("  AVISO: FFmpeg não encontrado. Copiando WAV sem re-encodar (pode afetar qualidade da transcrição).")
            shutil.copy2(input_path, wav_path)
            return wav_path
        raise RuntimeError(
            "FFmpeg não encontrado no PATH. Instale em https://ffmpeg.org/download.html\n"
            "Necessário para converter arquivos de vídeo ou áudio que não sejam WAV 16kHz mono."
        )

    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-ac", "1",        # mono
        "-ar", "16000",    # 16 kHz (ótimo para Whisper)
        "-vn",             # sem vídeo
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg falhou:\n{result.stderr}")
    return wav_path


def split_wav(wav_path: Path, parts_dir: Path) -> list[Path]:
    """
    Divide WAV em partes de no máximo AUDIO_CHUNK_MB MB em parts/part_001.wav...
    Se FFmpeg não estiver disponível e o arquivo couber no limite, retorna-o inteiro.
    """
    parts_dir.mkdir(parents=True, exist_ok=True)
    max_bytes = settings.audio_chunk_mb * 1024 * 1024
    file_size = wav_path.stat().st_size

    if file_size <= max_bytes:
        return [wav_path]

    if not _ffmpeg_available():
        print(
            f"  AVISO: FFmpeg não disponível para dividir áudio ({file_size / 1024 / 1024:.1f} MB > {settings.audio_chunk_mb} MB). "
            "Processando arquivo inteiro — a transcrição pode ser lenta ou falhar."
        )
        return [wav_path]

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(wav_path)],
        capture_output=True, text=True,
    )
    total_seconds = float(probe.stdout.strip())

    n_parts = math.ceil(file_size / max_bytes)
    part_duration = total_seconds / n_parts

    parts: list[Path] = []
    for i in range(n_parts):
        start = i * part_duration
        part_path = parts_dir / f"part_{i + 1:03d}.wav"
        cmd = [
            "ffmpeg", "-y", "-i", str(wav_path),
            "-ss", str(start), "-t", str(part_duration),
            "-ac", "1", "-ar", "16000",
            str(part_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg split falhou na parte {i + 1}:\n{result.stderr}")
        parts.append(part_path)

    return parts
