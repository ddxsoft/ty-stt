"""编辑态 AI 精修副驾驶：划词局部改写 / 自由指令修改 / 原稿核对还原。

输出仅为所选文本的替换内容，供前端做 Diff 审阅，不直接落盘。
"""

from __future__ import annotations

from typing import AsyncIterator

from app.agent.prompts import glossary_prompt_section
from app.llm.client import get_llm_client, is_mock_llm

_ACTION_PROMPTS = {
    "polish": "对选中文本进行润色，使其通顺自然、去除口语冗余，保持原意与篇幅大致不变。",
    "fix": "仅修正选中文本中的错别字、同音误识、标点和明显语病，最大限度保留原话。",
    "shorten": "在保留核心信息的前提下精简压缩选中文本，删除冗余表达。",
    "list": "将选中文本改写为清晰的 Markdown 无序或有序列表，不新增信息。",
    "table": "将选中文本中适合结构化的内容改写为 Markdown 表格，不新增信息。",
    "formal": "将选中文本转换为正式、规范的书面语表达，保持原意。",
    "verify": "结合提供的【原始逐字稿】核对选中文本，纠正误识、还原漏词，使其忠实于原始发音内容。",
}

_OUTPUT_RULES = (
    "\n\n输出要求：只输出改写后的选中文本本身，作为替换内容；"
    "不要任何解释、前言、结语或代码块包裹；不要输出 <think> 标签；"
    "不要重复输出上下文。"
)


def _build_system(action: str | None, instruction: str | None, glossary: dict | None) -> str:
    base = "你是一名中文文稿精修副驾驶，负责对用户选中的局部文本执行精确改写。"
    if action and action in _ACTION_PROMPTS:
        base += "\n\n本次任务：" + _ACTION_PROMPTS[action]
    if instruction:
        base += "\n\n用户的额外修改要求：" + instruction.strip()
    if not action and not instruction:
        base += "\n\n本次任务：润色选中文本，使其通顺自然，保持原意。"
    base += "\n\n严格保持原意，不新增事实，不加入你的观点。"
    if glossary:
        base += glossary_prompt_section(glossary)
    return base + _OUTPUT_RULES


def _build_user(
    selection: str,
    before: str | None,
    after: str | None,
    raw_transcript: str | None,
    action: str | None,
) -> str:
    parts: list[str] = []
    if before:
        parts.append(f"【选中部分之前的上文，仅供衔接参考】：\n{before[-300:]}")
    if after:
        parts.append(f"【选中部分之后的下文，仅供衔接参考】：\n{after[:300]}")
    if action == "verify" and raw_transcript:
        parts.append(f"【原始逐字稿，供核对还原】：\n{raw_transcript[:6000]}")
    parts.append(f"【需要改写的选中文本】：\n{selection}")
    return "\n\n".join(parts)


class CopilotAgent:
    async def rewrite_stream(
        self,
        selection: str,
        *,
        action: str | None = None,
        instruction: str | None = None,
        before: str | None = None,
        after: str | None = None,
        raw_transcript: str | None = None,
        glossary: dict | None = None,
    ) -> AsyncIterator[str]:
        if not selection.strip():
            return
        if is_mock_llm():
            yield selection
            return
        system = _build_system(action, instruction, glossary)
        user = _build_user(selection, before, after, raw_transcript, action)
        client = get_llm_client()
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        async for delta in client.stream(messages):
            yield delta