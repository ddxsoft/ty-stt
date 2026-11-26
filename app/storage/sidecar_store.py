"""侧车数据：原始音频、带时间戳转写 JSON、文档版本快照。"""

from __future__ import annotations

import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.config import settings

_AUDIO_CONTENT_TYPES = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".mp4": "audio/mp4",
}


def audio_content_type(path: Path) -> str:
    return _AUDIO_CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")


class SidecarStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()

    # ── 音频 ──
    def save_audio(self, doc_id: str, data: bytes, ext: str) -> Path:
        ext = ext if ext.startswith(".") else f".{ext}"
        settings.audio_dir.mkdir(parents=True, exist_ok=True)
        path = settings.audio_dir / f"{doc_id}{ext.lower()}"
        path.write_bytes(data)
        return path

    def audio_path(self, doc_id: str) -> Path | None:
        directory = settings.audio_dir
        if not directory.exists():
            return None
        for ext in _AUDIO_CONTENT_TYPES:
            candidate = directory / f"{doc_id}{ext}"
            if candidate.exists():
                return candidate
        return None

    def has_audio(self, doc_id: str) -> bool:
        return self.audio_path(doc_id) is not None

    def delete_audio(self, doc_id: str) -> None:
        path = self.audio_path(doc_id)
        if path is not None:
            path.unlink(missing_ok=True)

    # ── 转写 JSON ──
    def _transcript_path(self, doc_id: str) -> Path:
        return settings.transcripts_dir / f"{doc_id}.json"

    def save_transcript(self, doc_id: str, payload: dict[str, Any]) -> None:
        settings.transcripts_dir.mkdir(parents=True, exist_ok=True)
        self._transcript_path(doc_id).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def load_transcript(self, doc_id: str) -> dict[str, Any] | None:
        path = self._transcript_path(doc_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def has_transcript(self, doc_id: str) -> bool:
        return self._transcript_path(doc_id).exists()

    def delete_transcript(self, doc_id: str) -> None:
        self._transcript_path(doc_id).unlink(missing_ok=True)

    # ── 快照 ──
    def _snapshot_dir(self, doc_id: str) -> Path:
        return settings.snapshots_dir / doc_id

    def create_snapshot(self, doc_id: str, content: str, reason: str = "") -> dict[str, Any]:
        directory = self._snapshot_dir(doc_id)
        directory.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().astimezone()
        snapshot_id = f"{stamp.strftime('%Y%m%d%H%M%S')}_{uuid4().hex[:6]}"
        payload = {
            "snapshot_id": snapshot_id,
            "created_at": stamp.isoformat(timespec="seconds"),
            "char_count": len(content.strip()),
            "reason": reason,
            "content": content,
        }
        with self._lock:
            (directory / f"{snapshot_id}.json").write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        return {k: payload[k] for k in ("snapshot_id", "created_at", "char_count", "reason")}

    def list_snapshots(self, doc_id: str) -> list[dict[str, Any]]:
        directory = self._snapshot_dir(doc_id)
        if not directory.exists():
            return []
        snapshots: list[dict[str, Any]] = []
        for path in directory.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            snapshots.append(
                {
                    "snapshot_id": data.get("snapshot_id", path.stem),
                    "created_at": data.get("created_at", ""),
                    "char_count": data.get("char_count", 0),
                    "reason": data.get("reason", ""),
                }
            )
        snapshots.sort(key=lambda s: s["created_at"], reverse=True)
        return snapshots

    def get_snapshot_content(self, doc_id: str, snapshot_id: str) -> str | None:
        if "/" in snapshot_id or "\\" in snapshot_id or ".." in snapshot_id:
            return None
        path = self._snapshot_dir(doc_id) / f"{snapshot_id}.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        return data.get("content")

    def delete_snapshots(self, doc_id: str) -> None:
        directory = self._snapshot_dir(doc_id)
        if directory.exists():
            import shutil

            shutil.rmtree(directory, ignore_errors=True)


_sidecar: SidecarStore | None = None
_sidecar_lock = threading.Lock()


def get_sidecar() -> SidecarStore:
    global _sidecar
    with _sidecar_lock:
        if _sidecar is None:
            _sidecar = SidecarStore()
        return _sidecar