"""STT 引擎工厂：按 settings.stt_engine 选择实现。"""

from __future__ import annotations

import threading

from app.core.config import settings
from app.stt.base import BaseSTTEngine

_lock = threading.Lock()
_cache: dict[str, BaseSTTEngine] = {}


def get_engine() -> BaseSTTEngine:
    name = settings.stt_engine
    with _lock:
        engine = _cache.get(name)
        if engine is None:
            if name == "mock":
                from app.stt.mock_engine import MockSTTEngine

                engine = MockSTTEngine()
            else:
                from app.stt.funasr_engine import FunASREngine

                engine = FunASREngine()
            _cache[name] = engine
        return engine