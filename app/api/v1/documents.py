"""文档管理 API：列表/搜索/读取/更新/移动/删除/快照/导出。"""

from __future__ import annotations

import re
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.schemas import MoveDocumentBody, UpdateDocumentBody
from app.storage.markdown_store import DocumentNotFound, PathTraversalError, get_store
from app.storage.sidecar_store import get_sidecar

router = APIRouter(prefix="/documents", tags=["documents"])


def _summary(record) -> dict:
    sidecar = get_sidecar()
    return record.summary(
        has_audio=sidecar.has_audio(record.doc_id),
        has_transcript=sidecar.has_transcript(record.doc_id),
    )


def _detail(record) -> dict:
    sidecar = get_sidecar()
    transcript = sidecar.load_transcript(record.doc_id) or {}
    return {
        **_summary(record),
        "content": record.content,
        "frontmatter": record.frontmatter,
        "segments": transcript.get("segments", []),
        "raw_transcript": transcript.get("text", ""),
    }


def _read(doc_id: str):
    try:
        return get_store().read(doc_id)
    except DocumentNotFound as exc:
        raise HTTPException(status_code=404, detail="document not found") from exc


@router.get("")
async def list_documents(
    folder: str | None = Query(None),
    q: str | None = Query(None),
    tag: str | None = Query(None),
):
    records = get_store().list(folder=folder, q=q, tag=tag)
    return [_summary(r) for r in records]


@router.get("/{doc_id}")
async def get_document(doc_id: str):
    return _detail(_read(doc_id))


@router.put("/{doc_id}")
async def update_document(doc_id: str, body: UpdateDocumentBody):
    store = get_store()
    record = _read(doc_id)
    get_sidecar().create_snapshot(doc_id, record.content, reason="编辑保存")
    updated = store.update(doc_id, body.content, title=body.title, tags=body.tags)
    return _detail(updated)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: str):
    store = get_store()
    _read(doc_id)
    store.delete(doc_id)
    sidecar = get_sidecar()
    sidecar.delete_audio(doc_id)
    sidecar.delete_transcript(doc_id)
    sidecar.delete_snapshots(doc_id)
    return None


@router.post("/{doc_id}/move")
async def move_document(doc_id: str, body: MoveDocumentBody):
    _read(doc_id)
    try:
        record = get_store().move(doc_id, folder=body.folder, filename=body.filename)
    except PathTraversalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _detail(record)


@router.get("/{doc_id}/snapshots")
async def list_snapshots(doc_id: str):
    _read(doc_id)
    return get_sidecar().list_snapshots(doc_id)


@router.get("/{doc_id}/snapshots/{snapshot_id}")
async def get_snapshot(doc_id: str, snapshot_id: str):
    _read(doc_id)
    content = get_sidecar().get_snapshot_content(doc_id, snapshot_id)
    if content is None:
        raise HTTPException(status_code=404, detail="snapshot not found")
    return {"content": content}


@router.post("/{doc_id}/snapshots/{snapshot_id}/restore")
async def restore_snapshot(doc_id: str, snapshot_id: str):
    store = get_store()
    record = _read(doc_id)
    sidecar = get_sidecar()
    content = sidecar.get_snapshot_content(doc_id, snapshot_id)
    if content is None:
        raise HTTPException(status_code=404, detail="snapshot not found")
    sidecar.create_snapshot(doc_id, record.content, reason="回滚前自动快照")
    restored = store.write_full(doc_id, record.frontmatter, content)
    return _detail(restored)


@router.get("/{doc_id}/export")
async def export_document(doc_id: str, format: str = Query("md", pattern="^(md|txt)$")):
    record = _read(doc_id)
    safe_name = re.sub(r'[\\/:*?"<>|]', "", record.title).strip() or record.doc_id
    if format == "txt":
        text = re.sub(r"[#>*`_]", "", record.content)
        payload = text.encode("utf-8")
        media_type, filename = "text/plain; charset=utf-8", f"{safe_name}.txt"
    else:
        from app.storage.markdown_store import dump_frontmatter

        payload = dump_frontmatter(record.frontmatter, record.content).encode("utf-8")
        media_type, filename = "text/markdown; charset=utf-8", f"{safe_name}.md"
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )