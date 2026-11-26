"""异步任务队列 + SSE 广播 + 状态持久化。

任务状态：queued → preprocessing → transcribing → polishing → completed / failed / cancelled。
全局 SSE 推送 task / segment / delta 事件。 finished 任务持久化到 data/tasks.json。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from uuid import uuid4

from app.agent.pipeline import PipelineContext, TaskCancelled, run_pipeline
from app.core.config import settings
from app.core.logging import get_logger
from app.storage.markdown_store import now_iso

logger = get_logger(__name__)

FINISHED = {"completed", "failed", "cancelled"}
_IN_PROGRESS = {"queued", "preprocessing", "transcribing", "polishing"}


class TaskManager:
    def __init__(self) -> None:
        self._tasks: dict[str, dict] = {}
        self._queue: asyncio.Queue | None = None
        self._workers: list[asyncio.Task] = []
        self._subscribers: set[asyncio.Queue] = set()
        self._cancel: set[str] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._running = False

    # ── 生命周期 ──
    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._queue = asyncio.Queue()
        self._load_persisted()
        self._running = True
        for _ in range(max(1, settings.max_concurrent_tasks)):
            self._workers.append(asyncio.create_task(self._worker()))

    async def stop(self) -> None:
        self._running = False
        for worker in self._workers:
            worker.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    # ── SSE 广播 ──
    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def publish(self, event: str, data: dict) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait((event, data))
            except asyncio.QueueFull:
                pass

    # ── 持久化 ──
    def _persist(self) -> None:
        try:
            settings.data_dir.mkdir(parents=True, exist_ok=True)
            settings.tasks_path.write_text(
                json.dumps(list(self._tasks.values()), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as exc:
            logger.warning("failed to persist tasks: %s", exc)

    def _load_persisted(self) -> None:
        path = settings.tasks_path
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        for task in data:
            if not isinstance(task, dict) or "task_id" not in task:
                continue
            if task.get("status") in _IN_PROGRESS:
                task["status"] = "failed"
                task["error"] = "服务重启导致任务中断"
                task["stage_message"] = "已中断"
                task["updated_at"] = now_iso()
            self._tasks[task["task_id"]] = task

    # ── 查询 ──
    @staticmethod
    def _public(task: dict) -> dict:
        return {k: v for k, v in task.items() if not k.startswith("_")}

    def get_task(self, task_id: str) -> dict | None:
        task = self._tasks.get(task_id)
        return self._public(task) if task else None

    def list_tasks(self) -> list[dict]:
        tasks = sorted(self._tasks.values(), key=lambda t: t.get("created_at", ""), reverse=True)
        return [self._public(t) for t in tasks]

    # ── 创建 ──
    def create_task(
        self,
        *,
        filename: str,
        audio_path: Path,
        doc_id: str,
        folder: str,
        preset: str,
        hotwords: str,
        title: str | None,
    ) -> dict:
        task_id = f"task_{uuid4().hex[:12]}"
        stamp = now_iso()
        task = {
            "task_id": task_id,
            "filename": filename,
            "status": "queued",
            "progress": 0,
            "stage_message": "排队中…",
            "folder": folder,
            "preset": preset,
            "doc_id": None,
            "error": None,
            "created_at": stamp,
            "updated_at": stamp,
            "_doc_id": doc_id,
            "_audio_path": str(audio_path),
            "_hotwords": hotwords,
            "_title": title,
        }
        self._tasks[task_id] = task
        if self._queue is not None:
            self._queue.put_nowait(task_id)
        self._persist()
        self.publish("task", self._public(task))
        return self._public(task)

    # ── 阶段更新 ──
    async def _set_stage(self, task_id: str, status: str, progress: int, message: str) -> None:
        task = self._tasks.get(task_id)
        if not task:
            return
        task.update(status=status, progress=progress, stage_message=message, updated_at=now_iso())
        self._persist()
        self.publish("task", self._public(task))

    def _mark_cancelled(self, task_id: str) -> None:
        task = self._tasks.get(task_id)
        if task:
            task.update(status="cancelled", stage_message="已取消", updated_at=now_iso())
            self._persist()
            self.publish("task", self._public(task))
        self._cancel.discard(task_id)

    # ── 工作循环 ──
    async def _worker(self) -> None:
        while self._running:
            task_id = await self._queue.get()
            try:
                await self._process(task_id)
            except Exception:  # pragma: no cover
                logger.exception("task worker error: %s", task_id)
            finally:
                self._queue.task_done()

    async def _process(self, task_id: str) -> None:
        task = self._tasks.get(task_id)
        if not task:
            return
        if task["status"] in FINISHED:
            self._cancel.discard(task_id)
            return
        if task_id in self._cancel:
            self._mark_cancelled(task_id)
            return

        loop = self._loop

        def on_segment(segment) -> None:
            payload = {"task_id": task_id, **segment.to_dict()}
            if loop is not None:
                loop.call_soon_threadsafe(self.publish, "segment", payload)

        def emit_delta(text: str) -> None:
            self.publish("delta", {"task_id": task_id, "text": text})

        async def set_stage(status: str, progress: int, message: str) -> None:
            await self._set_stage(task_id, status, progress, message)

        def is_cancelled() -> bool:
            return task_id in self._cancel

        ctx = PipelineContext(task_id, set_stage, on_segment, emit_delta, is_cancelled)
        try:
            doc_id = await run_pipeline(
                ctx,
                audio_path=Path(task["_audio_path"]),
                doc_id=task["_doc_id"],
                folder=task["folder"],
                preset=task["preset"],
                hotwords=task["_hotwords"],
                title=task["_title"],
            )
            task.update(doc_id=doc_id, status="completed", progress=100, stage_message="完成", updated_at=now_iso())
        except TaskCancelled:
            task.update(status="cancelled", stage_message="已取消", updated_at=now_iso())
        except Exception as exc:
            logger.warning("task %s failed: %s", task_id, exc)
            task.update(status="failed", error=str(exc), stage_message="失败", updated_at=now_iso())
        finally:
            self._cancel.discard(task_id)
            self._persist()
            self.publish("task", self._public(task))

    # ── 控制 ──
    def cancel(self, task_id: str) -> dict | None:
        task = self._tasks.get(task_id)
        if not task:
            return None
        if task["status"] in FINISHED:
            return self._public(task)
        self._cancel.add(task_id)
        if task["status"] == "queued":
            self._mark_cancelled(task_id)
        return self._public(task)

    def retry(self, task_id: str) -> dict | None:
        task = self._tasks.get(task_id)
        if not task:
            return None
        if task["status"] not in ("failed", "cancelled"):
            raise ValueError("only failed or cancelled tasks can be retried")
        self._cancel.discard(task_id)
        task.update(
            status="queued", progress=0, error=None, stage_message="排队中…",
            doc_id=None, updated_at=now_iso(),
        )
        if self._queue is not None:
            self._queue.put_nowait(task_id)
        self._persist()
        self.publish("task", self._public(task))
        return self._public(task)

    def delete(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        if not task:
            return False
        if task["status"] not in FINISHED:
            raise ValueError("only finished tasks can be deleted")
        del self._tasks[task_id]
        self._persist()
        return True


_manager: TaskManager | None = None


def get_task_manager() -> TaskManager:
    global _manager
    if _manager is None:
        _manager = TaskManager()
    return _manager