"""音文转写精修主管道：预处理 → STT → 润色 → 落盘。

通过 PipelineContext 回调与任务队列解耦：阶段进度、实时分段、流式润色文本、取消检查。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable

from app.agent.polish_agent import PolishAgent, suggest_title
from app.agent.prompts import combine_hotwords, load_glossary
from app.core.config import settings
from app.core.logging import get_logger
from app.storage.markdown_store import get_store
from app.storage.sidecar_store import get_sidecar
from app.stt.audio_proc import probe_audio
from app.stt.base import TranscriptResult, TranscriptSegment
from app.stt.engine import get_engine

logger = get_logger(__name__)


class TaskCancelled(Exception):
    pass


@dataclass
class PipelineContext:
    task_id: str
    set_stage: Callable[[str, int, str], Awaitable[None]]
    on_segment: Callable[[TranscriptSegment], None]
    emit_delta: Callable[[str], None]
    is_cancelled: Callable[[], bool]


def format_raw_transcript(result: TranscriptResult) -> str:
    if result.segments:
        return "\n\n".join(seg.text for seg in result.segments if seg.text).strip()
    return result.text.strip()


async def run_pipeline(
    ctx: PipelineContext,
    *,
    audio_path: Path,
    doc_id: str,
    folder: str,
    preset: str,
    hotwords: str,
    title: str | None,
) -> str:
    sidecar = get_sidecar()
    store = get_store()

    await ctx.set_stage("preprocessing", 5, "预处理音频…")
    info = await asyncio.to_thread(probe_audio, audio_path)
    if ctx.is_cancelled():
        raise TaskCancelled()

    await ctx.set_stage("transcribing", 15, "语音识别中…")
    glossary = load_glossary()
    combined_hotwords = combine_hotwords(glossary, hotwords)
    engine = get_engine()
    result = await engine.transcribe(audio_path, hotwords=combined_hotwords, on_segment=ctx.on_segment)
    if ctx.is_cancelled():
        raise TaskCancelled()

    transcript_payload = result.to_dict()
    transcript_payload["source_audio"] = audio_path.name
    transcript_payload["stt_engine"] = settings.stt_engine
    sidecar.save_transcript(doc_id, transcript_payload)

    await ctx.set_stage("polishing", 60, "AI 润色中…")
    if preset == "none":
        body = format_raw_transcript(result)
    else:
        agent = PolishAgent()
        parts: list[str] = []
        async for delta in agent.polish_stream(result.text, preset, glossary=glossary):
            if ctx.is_cancelled():
                raise TaskCancelled()
            parts.append(delta)
            ctx.emit_delta(delta)
        body = "".join(parts).strip() or format_raw_transcript(result)
    if ctx.is_cancelled():
        raise TaskCancelled()

    await ctx.set_stage("polishing", 90, "生成文档…")
    tags: list[str] = []
    if title and title.strip():
        doc_title = title.strip()
    else:
        suggestion = await suggest_title(body)
        doc_title = suggestion["title"]
        tags = suggestion["tags"]

    extra_meta = {
        "source_audio": audio_path.name,
        "duration_seconds": round(info.duration_seconds, 3),
        "stt_engine": settings.stt_engine,
        "polish_preset": preset,
        "tags": tags,
    }
    store.create(
        doc_id=doc_id,
        title=doc_title,
        folder=folder,
        content=body,
        extra_meta=extra_meta,
    )
    await ctx.set_stage("completed", 100, "完成")
    return doc_id