"""音频预处理：ffprobe 时长/声道/采样率探测，ffmpeg 标准化，按毫秒切片。"""

from __future__ import annotations

import json
import shutil
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path


class AudioProcessingError(RuntimeError):
    pass


@dataclass
class AudioInfo:
    duration_seconds: float
    sample_rate: int
    channels: int


def find_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def find_ffprobe() -> str | None:
    return shutil.which("ffprobe")


def probe_audio(path: Path) -> AudioInfo:
    ffprobe = find_ffprobe()
    if not ffprobe:
        return AudioInfo(_wav_duration(path) or 0.0, 16000, 1)
    result = subprocess.run(
        [
            ffprobe,
            "-v", "error",
            "-show_entries", "format=duration:stream=sample_rate,channels",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return AudioInfo(_wav_duration(path) or 0.0, 16000, 1)
    try:
        data = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return AudioInfo(_wav_duration(path) or 0.0, 16000, 1)
    duration = float(data.get("format", {}).get("duration", 0.0) or 0.0)
    sample_rate, channels = 16000, 1
    for stream in data.get("streams", []):
        if stream.get("sample_rate"):
            sample_rate = int(stream["sample_rate"])
        if stream.get("channels"):
            channels = int(stream["channels"])
        break
    if duration <= 0:
        duration = _wav_duration(path) or 0.0
    return AudioInfo(duration, sample_rate, channels)


def _wav_duration(path: Path) -> float | None:
    if path.suffix.lower() != ".wav":
        return None
    try:
        with wave.open(str(path), "rb") as wav_file:
            frames = wav_file.getnframes()
            rate = wav_file.getframerate() or 1
        return frames / rate
    except (wave.Error, OSError):
        return None


def normalize_to_wav(src: Path, dst: Path) -> Path:
    """转码为 16kHz 单声道 16bit WAV，供 STT 使用。"""
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise AudioProcessingError("ffmpeg not found; install ffmpeg to process audio")
    dst.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src), "-ac", "1", "-ar", "16000", "-sample_fmt", "s16",
            str(dst),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AudioProcessingError(result.stderr.strip() or "ffmpeg failed to normalize audio")
    return dst


def slice_wav(src: Path, dst: Path, start_ms: int, end_ms: int) -> Path:
    """从 16kHz 单声道 WAV 中按毫秒区间切片。"""
    dst.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(src), "rb") as wav_file:
        rate = wav_file.getframerate()
        channels = wav_file.getnchannels()
        width = wav_file.getsampwidth()
        total = wav_file.getnframes()
        start_frame = max(0, int(start_ms / 1000 * rate))
        end_frame = min(total, int(end_ms / 1000 * rate))
        if end_frame <= start_frame:
            end_frame = min(total, start_frame + 1)
        wav_file.setpos(start_frame)
        frames = wav_file.readframes(end_frame - start_frame)
    with wave.open(str(dst), "wb") as out:
        out.setnchannels(channels)
        out.setsampwidth(width)
        out.setframerate(rate)
        out.writeframes(frames)
    return dst