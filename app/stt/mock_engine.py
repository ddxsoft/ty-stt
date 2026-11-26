"""Mock STT 引擎：无需模型，产出带时间戳的确定性分段，供测试与无 GPU 演示。"""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.core.config import settings
from app.stt.audio_proc import probe_audio
from app.stt.base import BaseSTTEngine, SegmentCallback, TranscriptResult, TranscriptSegment

_SAMPLE_LINES = [
    "大家好，今天我们讨论一下项目的整体进度。",
    "首先是语音识别的精度问题，需要引入智能断句。",
    "接下来是文稿润色，要去除口语填充词并保持原意。",
    "最后，所有文档直接保存为本地 Markdown 文件。",
]


class MockSTTEngine(BaseSTTEngine):
    async def transcribe(
        self,
        audio_path: Path,
        *,
        hotwords: str = "",
        on_segment: SegmentCallback | None = None,
    ) -> TranscriptResult:
        return await asyncio.to_thread(self._run, audio_path, on_segment)

    def _run(self, audio_path: Path, on_segment: SegmentCallback | None) -> TranscriptResult:
        info = probe_audio(audio_path)
        duration_ms = int(info.duration_seconds * 1000) or 4000
        count = len(_SAMPLE_LINES)
        step = max(1, duration_ms // count)
        segments: list[TranscriptSegment] = []
        for index, line in enumerate(_SAMPLE_LINES):
            start = index * step
            end = duration_ms if index == count - 1 else (index + 1) * step
            segment = TranscriptSegment(index, start, end, line)
            segments.append(segment)
            if on_segment:
                on_segment(segment)
        return TranscriptResult(
            language=settings.stt_language,
            text="".join(s.text for s in segments),
            segments=segments,
            duration_seconds=duration_ms / 1000,
        )