"""转写任务 API 测试：上传、异步完成、SSE、取消/重试/删除（mock 引擎）。"""

from __future__ import annotations

import pytest

from tests.conftest import make_wav_bytes, wait_for_task


def _upload(client, folder="", preset="medium", hotwords="", title=""):
    data = {"folder": folder, "preset": preset}
    if hotwords:
        data["hotwords"] = hotwords
    if title:
        data["title"] = title
    return client.post(
        "/api/v1/transcriptions",
        files={"files": ("sample.wav", make_wav_bytes(2.0), "audio/wav")},
        data=data,
    )


def test_upload_returns_202_and_completes(client):
    resp = _upload(client, folder="会议", preset="medium", title="复盘会议")
    assert resp.status_code == 202
    tasks = resp.json()["tasks"]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["status"] == "queued"
    assert task["doc_id"] is None

    done = wait_for_task(client, task["task_id"], "completed")
    assert done["status"] == "completed"
    assert done["progress"] == 100
    assert done["doc_id"]

    detail = client.get(f"/api/v1/documents/{done['doc_id']}").json()
    assert detail["folder"] == "会议"
    assert detail["title"] == "复盘会议"
    assert detail["has_audio"] is True
    assert detail["has_transcript"] is True
    assert len(detail["segments"]) > 0
    assert detail["segments"][0]["end_ms"] > detail["segments"][0]["start_ms"]


def test_preset_none_raw_transcript(client):
    resp = _upload(client, preset="none")
    task = resp.json()["tasks"][0]
    done = wait_for_task(client, task["task_id"])
    detail = client.get(f"/api/v1/documents/{done['doc_id']}").json()
    assert detail["frontmatter"]["polish_preset"] == "none"
    assert detail["content"]


def test_task_list_and_get(client):
    task = _upload(client).json()["tasks"][0]
    wait_for_task(client, task["task_id"])
    listing = client.get("/api/v1/transcriptions").json()
    assert any(t["task_id"] == task["task_id"] for t in listing)
    assert client.get(f"/api/v1/transcriptions/{task['task_id']}").status_code == 200
    assert client.get("/api/v1/transcriptions/missing").status_code == 404


def test_retry_and_delete(client):
    task = _upload(client).json()["tasks"][0]
    wait_for_task(client, task["task_id"])
    # completed 任务不可重试
    assert client.post(f"/api/v1/transcriptions/{task['task_id']}/retry").status_code == 400
    # finished 任务可删除
    assert client.delete(f"/api/v1/transcriptions/{task['task_id']}").status_code == 204
    assert client.get(f"/api/v1/transcriptions/{task['task_id']}").status_code == 404


def test_cancel_queued_task(client):
    # 上传多个文件制造排队，取消其中一个 queued 任务
    resp = client.post(
        "/api/v1/transcriptions",
        files=[
            ("files", ("a.wav", make_wav_bytes(1.0), "audio/wav")),
            ("files", ("b.wav", make_wav_bytes(1.0), "audio/wav")),
            ("files", ("c.wav", make_wav_bytes(1.0), "audio/wav")),
        ],
        data={"preset": "none"},
    )
    tasks = resp.json()["tasks"]
    cancelled = client.post(f"/api/v1/transcriptions/{tasks[-1]['task_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] in ("cancelled", "queued", "transcribing", "polishing")


@pytest.mark.anyio
async def test_global_sse_generator(tmp_path):
    import asyncio

    import app.storage.task_manager as tm
    from app.api.v1.transcriptions import stream_transcriptions
    from app.core.config import settings

    settings.data_dir = tmp_path / "data"
    settings.output_dir = tmp_path / "ws"
    settings.ensure_dirs()
    manager = tm.TaskManager()
    tm._manager = manager
    await manager.start()
    try:
        manager._tasks["t1"] = {
            "task_id": "t1", "filename": "a.wav", "status": "completed", "progress": 100,
            "stage_message": "完成", "folder": "", "preset": "none", "doc_id": "d1",
            "error": None, "created_at": "2026-01-01T00:00:00", "updated_at": "2026-01-01T00:00:00",
        }
        resp = await stream_transcriptions()
        gen = resp.body_iterator
        first = await asyncio.wait_for(gen.__anext__(), 2)
        assert "event: task" in first and "t1" in first
        manager.publish("delta", {"task_id": "t1", "text": "你好"})
        second = await asyncio.wait_for(gen.__anext__(), 2)
        assert "event: delta" in second and "你好" in second
        await gen.aclose()
    finally:
        await manager.stop()
        tm._manager = None


def test_unsupported_format(client):
    resp = client.post(
        "/api/v1/transcriptions",
        files={"files": ("note.txt", b"not audio", "text/plain")},
        data={"preset": "medium"},
    )
    assert resp.status_code == 400