"""pytest 共享夹具：隔离临时数据/输出目录，mock STT 与 mock LLM，无外部依赖。"""

from __future__ import annotations

import io
import os
import tempfile
import wave

import pytest

# 在导入 app 之前设置环境，确保 settings 单例使用 mock 与临时目录
os.environ["TYSTT_STT_ENGINE"] = "mock"
os.environ["TYSTT_LLM_MODEL"] = "mock"
os.environ["TYSTT_LLM_BASE_URL"] = ""
os.environ["TYSTT_MAX_CONCURRENT_TASKS"] = "2"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402
import app.storage.task_manager as tm  # noqa: E402
import app.storage.markdown_store as ms  # noqa: E402


def make_wav_bytes(seconds: float = 2.0, rate: int = 16000) -> bytes:
    frames = int(seconds * rate)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(rate)
        wav_file.writeframes(b"\x00\x00" * frames)
    return buffer.getvalue()


@pytest.fixture()
def client(tmp_path):
    settings.data_dir = tmp_path / "data"
    settings.output_dir = tmp_path / "workspace"
    settings.ensure_dirs()
    # 重置单例，保证测试间隔离
    tm._manager = None
    ms._store = None
    with TestClient(app) as test_client:
        yield test_client


def parse_sse(text: str) -> list[tuple[str, dict]]:
    import json

    events: list[tuple[str, dict]] = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        event, data = "message", None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event = line[len("event:"):].strip()
            elif line.startswith("data:"):
                raw = line[len("data:"):].strip()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    data = {}
        if data is not None:
            events.append((event, data))
    return events


def wait_for_task(client: TestClient, task_id: str, status: str = "completed", timeout: float = 8.0) -> dict:
    import time

    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = client.get(f"/api/v1/transcriptions/{task_id}")
        assert resp.status_code == 200
        task = resp.json()
        if task["status"] == status or task["status"] in ("failed", "cancelled"):
            return task
        time.sleep(0.05)
    raise AssertionError(f"task {task_id} did not reach {status}: {task}")