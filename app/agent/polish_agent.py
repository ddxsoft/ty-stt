"""长文分块润色智能体：语义分块 + 上下文衔接 + 术语纠错 + 流式输出。

``<think>`` 剥离由 LLM 客户端负责。预设 ``none`` 不调用大模型，直接返回原文。
"""

from __future__ import annotations

import json
import re
from typing import AsyncIterator

from app.agent.prompts import get_preset, glossary_prompt_section
from app.core.config import settings
from app.llm.client import get_llm_client, is_mock_llm

_SENTENCE_RE = re.compile(r"[^。！？!?.\n]*[。！？!?.\n]+|[^。！？!?.\n]+$")


def split_text(text: str, max_chars: int) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    sentences = [m.group(0) for m in _SENTENCE_RE.finditer(text) if m.group(0).strip()]
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for start in range(0, len(sentence), max_chars):
                chunks.append(sentence[start:start + max_chars])
            continue
        if current and len(current) + len(sentence) > max_chars:
            chunks.append(current)
            current = sentence
        else:
            current += sentence
    if current:
        chunks.append(current)
    return chunks


def _user_prompt(chunk: str, prev_context: str) -> str:
    if prev_context:
        return (
            f"【上一段结尾，仅供上下文衔接参考，不要重复输出】：\n{prev_context}\n\n"
            f"【需要润色的文本】：\n{chunk}"
        )
    return f"【需要润色的文本】：\n{chunk}"


class PolishAgent:
    async def polish_stream(
        self,
        text: str,
        preset_id: str,
        *,
        glossary: dict | None = None,
    ) -> AsyncIterator[str]:
        preset = get_preset(preset_id) or get_preset("medium")
        system_prompt = (preset or {}).get("system_prompt", "")
        if preset_id == "none" or not system_prompt:
            if text:
                yield text
            return
        if glossary:
            system_prompt += glossary_prompt_section(glossary)

        chunks = split_text(text, settings.polish_chunk_chars)
        if is_mock_llm():
            for index, chunk in enumerate(chunks):
                if index > 0:
                    yield "\n\n"
                yield chunk
            return

        client = get_llm_client()
        prev_context = ""
        for index, chunk in enumerate(chunks):
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": _user_prompt(chunk, prev_context)},
            ]
            if index > 0:
                yield "\n\n"
            async for delta in client.stream(messages):
                yield delta
            prev_context = chunk[-settings.polish_context_chars:]

    async def polish_full(self, text: str, preset_id: str, *, glossary: dict | None = None) -> str:
        parts = [delta async for delta in self.polish_stream(text, preset_id, glossary=glossary)]
        return "".join(parts).strip()


_TITLE_SYSTEM = (
    "你是文档命名助手。根据用户提供的文稿正文，生成一个简洁准确的中文标题（不超过 24 字）"
    "和 2-4 个主题标签。只输出 JSON，格式：{\"title\": \"...\", \"tags\": [\"...\"]}，"
    "不要任何解释或代码块。"
)


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


async def suggest_title(content: str) -> dict:
    body = content.strip()
    fallback_title = ""
    for line in body.splitlines():
        cleaned = line.lstrip("# ").strip()
        if cleaned:
            fallback_title = cleaned[:24]
            break
    if not fallback_title:
        fallback_title = "未命名文稿"

    if is_mock_llm() or not body:
        return {"title": fallback_title, "tags": []}

    client = get_llm_client()
    messages = [
        {"role": "system", "content": _TITLE_SYSTEM},
        {"role": "user", "content": body[:4000]},
    ]
    try:
        raw = await client.complete(messages, temperature=0.2)
    except Exception:
        return {"title": fallback_title, "tags": []}
    data = _extract_json(raw)
    if not data:
        return {"title": fallback_title, "tags": []}
    title = str(data.get("title") or fallback_title).strip()[:24] or fallback_title
    tags = data.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    tags = [str(t).strip() for t in tags if str(t).strip()][:4]
    return {"title": title, "tags": tags}