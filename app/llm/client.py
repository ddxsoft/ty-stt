"""原生 AsyncOpenAI 统一适配层（兼容 Ollama / DeepSeek / Qwen / OpenAI / vLLM）。

- 流式 / 非流式调用
- ``<think>...</think>`` 推理标签自动剥离（兼容跨块与未闭合流式场景）
- mock 模式（model == "mock"）用于无外部依赖测试
"""

from __future__ import annotations

import re
import threading
from typing import AsyncIterator

from app.core.config import settings

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_THINK_UNCLOSED_RE = re.compile(r"<think>.*$", re.DOTALL | re.IGNORECASE)


def strip_think(text: str) -> str:
    text = _THINK_BLOCK_RE.sub("", text)
    text = _THINK_UNCLOSED_RE.sub("", text)
    return text.strip()


class ThinkStreamFilter:
    """增量剥离 <think> 块，仅输出正文。处理标签跨 chunk 边界与未闭合场景。"""

    OPEN = "<think>"
    CLOSE = "</think>"

    def __init__(self) -> None:
        self.inside = False
        self.pending = ""

    @staticmethod
    def _partial_suffix(text: str, tag: str) -> int:
        max_len = min(len(text), len(tag) - 1)
        for size in range(max_len, 0, -1):
            if text.endswith(tag[:size]):
                return size
        return 0

    def feed(self, chunk: str) -> str:
        self.pending += chunk
        out: list[str] = []
        while True:
            if not self.inside:
                idx = self.pending.find(self.OPEN)
                if idx == -1:
                    keep = self._partial_suffix(self.pending, self.OPEN)
                    cut = len(self.pending) - keep
                    out.append(self.pending[:cut])
                    self.pending = self.pending[cut:]
                    break
                out.append(self.pending[:idx])
                self.pending = self.pending[idx + len(self.OPEN):]
                self.inside = True
            else:
                idx = self.pending.find(self.CLOSE)
                if idx == -1:
                    keep = self._partial_suffix(self.pending, self.CLOSE)
                    self.pending = self.pending[len(self.pending) - keep:]
                    break
                self.pending = self.pending[idx + len(self.CLOSE):]
                self.inside = False
        return "".join(out)

    def flush(self) -> str:
        if self.inside:
            self.pending = ""
            return ""
        text = self.pending
        self.pending = ""
        return text


def is_mock_llm() -> bool:
    return settings.llm_model.strip().lower() == "mock" or not settings.llm_base_url.strip()


class LLMClient:
    def __init__(self, base_url: str, api_key: str, model: str, temperature: float, mock: bool) -> None:
        self.model = model
        self.temperature = temperature
        self.mock = mock
        self._client = None
        if not mock:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(base_url=base_url, api_key=api_key or "sk-none", timeout=120.0)

    async def stream(self, messages: list[dict], temperature: float | None = None) -> AsyncIterator[str]:
        temp = self.temperature if temperature is None else temperature
        if self.mock:
            text = _last_user_content(messages)
            for start in range(0, len(text), 24):
                yield text[start:start + 24]
            return
        filt = ThinkStreamFilter()
        stream = await self._client.chat.completions.create(
            model=self.model, messages=messages, temperature=temp, stream=True
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content or ""
            if delta:
                cleaned = filt.feed(delta)
                if cleaned:
                    yield cleaned
        tail = filt.flush()
        if tail:
            yield tail

    async def complete(self, messages: list[dict], temperature: float | None = None) -> str:
        temp = self.temperature if temperature is None else temperature
        if self.mock:
            return _last_user_content(messages)
        resp = await self._client.chat.completions.create(
            model=self.model, messages=messages, temperature=temp, stream=False
        )
        return strip_think(resp.choices[0].message.content or "")

    async def list_models(self) -> list[str]:
        if self.mock:
            return ["mock"]
        result = await self._client.models.list()
        return [m.id for m in result.data]


def _last_user_content(messages: list[dict]) -> str:
    for message in reversed(messages):
        if message.get("role") == "user":
            return str(message.get("content", ""))
    return ""


_lock = threading.Lock()
_cache: dict[tuple, LLMClient] = {}


def get_llm_client() -> LLMClient:
    mock = is_mock_llm()
    key = (settings.llm_base_url, settings.llm_api_key, settings.llm_model, mock)
    with _lock:
        client = _cache.get(key)
        if client is None:
            client = LLMClient(
                base_url=settings.llm_base_url,
                api_key=settings.llm_api_key,
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                mock=mock,
            )
            _cache[key] = client
        return client