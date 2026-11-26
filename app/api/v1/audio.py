"""音频回放 API：支持 Range 请求头的流式播放。"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.storage.sidecar_store import audio_content_type, get_sidecar

router = APIRouter(prefix="/audio", tags=["audio"])

_CHUNK = 64 * 1024
_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _iter_file(path: Path, start: int, length: int):
    with path.open("rb") as handle:
        handle.seek(start)
        remaining = length
        while remaining > 0:
            chunk = handle.read(min(_CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/{doc_id}")
async def stream_audio(doc_id: str, request: Request):
    path = get_sidecar().audio_path(doc_id)
    if path is None:
        raise HTTPException(status_code=404, detail="audio not found")
    file_size = path.stat().st_size
    content_type = audio_content_type(path)
    range_header = request.headers.get("range")

    if range_header:
        match = _RANGE_RE.match(range_header.strip())
        if not match:
            raise HTTPException(status_code=416, detail="invalid range")
        start_raw, end_raw = match.group(1), match.group(2)
        if start_raw:
            start = int(start_raw)
            end = int(end_raw) if end_raw else file_size - 1
        elif end_raw:
            start = max(0, file_size - int(end_raw))
            end = file_size - 1
        else:
            raise HTTPException(status_code=416, detail="invalid range")
        end = min(end, file_size - 1)
        if start >= file_size or start > end:
            raise HTTPException(status_code=416, detail="range not satisfiable")
        length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
        }
        return StreamingResponse(_iter_file(path, start, length), status_code=206, media_type=content_type, headers=headers)

    headers = {"Accept-Ranges": "bytes", "Content-Length": str(file_size)}
    return StreamingResponse(_iter_file(path, 0, file_size), status_code=200, media_type=content_type, headers=headers)