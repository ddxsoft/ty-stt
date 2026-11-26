"""转写任务 API：上传/批量、任务列表、SSE 进度流、取消/重试/删除。"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.api.sse import format_event, sse_response
from app.storage.task_manager import get_task_manager
from app.storage.uploads import UnsupportedAudioFormat, save_upload

router = APIRouter(prefix="/transcriptions", tags=["transcriptions"])


@router.post("", status_code=202)
async def create_transcriptions(
    files: list[UploadFile] = File(...),
    folder: str = Form(""),
    preset: str = Form("medium"),
    hotwords: str = Form(""),
    title: str = Form(""),
):
    manager = get_task_manager()
    tasks = []
    for index, file in enumerate(files):
        try:
            doc_id, audio_path, _ext = await save_upload(file)
        except UnsupportedAudioFormat as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        task_title = title.strip() if (len(files) == 1 and title.strip()) else None
        tasks.append(
            manager.create_task(
                filename=file.filename or f"audio_{index}",
                audio_path=audio_path,
                doc_id=doc_id,
                folder=folder,
                preset=preset or "medium",
                hotwords=hotwords,
                title=task_title,
            )
        )
    return {"tasks": tasks}


@router.get("")
async def list_transcriptions():
    return get_task_manager().list_tasks()


@router.get("/stream")
async def stream_transcriptions():
    manager = get_task_manager()

    async def event_gen():
        queue = manager.subscribe()
        try:
            for task in manager.list_tasks():
                yield format_event("task", task)
            while True:
                try:
                    event, data = await asyncio.wait_for(queue.get(), timeout=15)
                    yield format_event(event, data)
                except asyncio.TimeoutError:
                    yield format_event("ping", {})
        finally:
            manager.unsubscribe(queue)

    return sse_response(event_gen())


@router.get("/{task_id}")
async def get_transcription(task_id: str):
    task = get_task_manager().get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return task


@router.post("/{task_id}/cancel")
async def cancel_transcription(task_id: str):
    task = get_task_manager().cancel(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return task


@router.post("/{task_id}/retry")
async def retry_transcription(task_id: str):
    try:
        task = get_task_manager().retry(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_transcription(task_id: str):
    try:
        deleted = get_task_manager().delete(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="task not found")
    return None