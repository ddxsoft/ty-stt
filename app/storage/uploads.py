"""上传音频落盘：扩展名探测、校验、保存为侧车音频。"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.storage.sidecar_store import get_sidecar

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".flac", ".ogg", ".aac", ".mp4"}

_CONTENT_TYPE_EXTENSIONS = {
    "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav", "audio/vnd.wave": ".wav",
    "audio/mpeg": ".mp3", "audio/mp3": ".mp3",
    "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "video/mp4": ".mp4",
    "audio/webm": ".webm", "video/webm": ".webm",
    "audio/flac": ".flac", "audio/x-flac": ".flac",
    "audio/ogg": ".ogg", "application/ogg": ".ogg",
    "audio/aac": ".aac",
}


class UnsupportedAudioFormat(ValueError):
    pass


def build_doc_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"doc_{stamp}_{uuid4().hex[:8]}"


def detect_extension(filename: str, content_type: str, header: bytes) -> str:
    if len(header) >= 12 and header[0:4] == b"RIFF" and header[8:12] == b"WAVE":
        return ".wav"
    if header[0:4] == b"fLaC":
        return ".flac"
    if header[0:4] == b"OggS":
        return ".ogg"
    if header[0:4] == b"ID3":
        return ".mp3"
    if header[0:4] == b"\x1a\x45\xdf\xa3":
        return ".webm"
    if len(header) >= 8 and header[4:8] == b"ftyp":
        return ".m4a"
    if len(header) >= 2 and header[0] == 0xFF:
        if header[1] in (0xF1, 0xF9):
            return ".aac"
        if header[1] in (0xFB, 0xF3, 0xF2):
            return ".mp3"
    ext = Path(filename or "").suffix.lower()
    if ext in ALLOWED_EXTENSIONS:
        return ext
    return _CONTENT_TYPE_EXTENSIONS.get((content_type or "").split(";")[0].lower().strip(), "")


async def save_upload(file: UploadFile) -> tuple[str, Path, str]:
    header = await file.read(16)
    await file.seek(0)
    ext = detect_extension(file.filename or "", file.content_type or "", header)
    if ext not in ALLOWED_EXTENSIONS:
        raise UnsupportedAudioFormat("仅支持 mp3/wav/m4a/webm/flac/ogg/aac/mp4 音频")
    chunks: list[bytes] = [header]
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        chunks.append(chunk)
    data = b"".join(chunks)
    await file.close()
    doc_id = build_doc_id()
    path = get_sidecar().save_audio(doc_id, data, ext)
    return doc_id, path, ext