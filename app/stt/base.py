"""STT 引擎抽象与结构化转写结果。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable


@dataclass
class TranscriptSegment:
    id: int
    start_ms: int
    end_ms: int
    text: str

    def to_dict(self) -> dict:
        return {"id": self.id, "start_ms": self.start_ms, "end_ms": self.end_ms, "text": self.text}


@dataclass
class TranscriptResult:
    language: str
    text: str
    segments: list[TranscriptSegment] = field(default_factory=list)
    duration_seconds: float = 0.0

    def to_dict(self) -> dict:
        return {
            "language": self.language,
            "text": self.text,
            "segments": [s.to_dict() for s in self.segments],
            "duration_seconds": self.duration_seconds,
        }


SegmentCallback = Callable[[TranscriptSegment], None]


class BaseSTTEngine(ABC):
    """转写引擎协议。``on_segment`` 在每个分段完成时同步回调（可能在工作线程中）。"""

    @abstractmethod
    async def transcribe(
        self,
        audio_path: Path,
        *,
        hotwords: str = "",
        on_segment: SegmentCallback | None = None,
    ) -> TranscriptResult:
        raise NotImplementedError