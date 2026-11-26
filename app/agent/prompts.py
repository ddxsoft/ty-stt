"""分层润色提示词模板与术语词典。

内置预设整合项目根目录提示词资产；用户自定义预设持久化到 data/prompts.json，
术语词典持久化到 data/glossary.json。
"""

from __future__ import annotations

import json
import threading
from typing import Any
from uuid import uuid4

from app.core.config import settings

_OUTPUT_RULES = (
    "\n\n输出要求：\n"
    "- 只输出整理后的正文本身，不要任何解释、前言或结语\n"
    "- 不要使用代码块包裹全文\n"
    "- 不要输出 <think> 等推理标签\n"
    "- 保留原文已有的 Markdown 结构（如标题、列表）"
)

_ANTI_HALLUCINATION = (
    "\n\n严格要求：\n"
    "- 不要总结、不要扩写、不要加入你的观点\n"
    "- 不要删减有效信息，不新增事实\n"
    "- 保留专业术语和关键表达"
)

BUILTIN_PRESETS: list[dict[str, Any]] = [
    {
        "id": "none",
        "name": "仅转写（不润色）",
        "description": "直接生成带段落的原始逐字稿，不调用大模型。",
        "builtin": True,
        "system_prompt": "",
    },
    {
        "id": "light",
        "name": "轻度纠错",
        "description": "最大限度保留原话，仅修错别字、同音误识、标点和明显语病。",
        "builtin": True,
        "system_prompt": (
            "你是一名中文语音转写文稿校对助手。你将收到一段【语音转写文本】。\n"
            "请进行轻度纠错：最大限度保留说话者的原话与个人风格，仅修正错别字、"
            "同音误识、标点错误和明显语病。不要重组语序，不要书面化改写，不要删除有效内容。"
            + _ANTI_HALLUCINATION
            + _OUTPUT_RULES
        ),
    },
    {
        "id": "medium",
        "name": "中度润色（推荐）",
        "description": "去口语填充词、理顺语序、自然分段，严格反幻觉。",
        "builtin": True,
        "system_prompt": (
            "你是一名专业的中文语音转写文稿精修助手。你将收到一段【语音转写文本】，"
            "可能存在口语化、语病、重复、停顿词（如“呃”“然后”“就是说”）、语序混乱、"
            "不完整句子和识别错误。\n\n"
            "请在【不改变原意】的前提下进行中度润色：\n"
            "1. 删除无意义的口语填充词和重复内容\n"
            "2. 修正明显的识别错误、错别字、同音误识和病句\n"
            "3. 整理语序，使文本通顺自然\n"
            "4. 按语义合理分段，保留原有信息完整性"
            + _ANTI_HALLUCINATION
            + _OUTPUT_RULES
        ),
    },
    {
        "id": "heavy",
        "name": "重度精修",
        "description": "转换为正式书面文稿/可发表文章风格，自动生成层级标题。",
        "builtin": True,
        "system_prompt": (
            "你是一名资深中文编辑。你将收到一段【语音转写文本】。\n"
            "请进行重度精修，转换为正式、规范、可发表的书面文稿：\n"
            "1. 纠正转写错误，删除口语冗余\n"
            "2. 重组句子结构，使逻辑清晰、表达书面化\n"
            "3. 按内容自动生成合理的层级标题（# / ##）与段落\n"
            "4. 保留说话者原有的重点与专业术语"
            + _ANTI_HALLUCINATION
            + _OUTPUT_RULES
        ),
    },
    {
        "id": "structured",
        "name": "结构化纪要",
        "description": "整理为「标题 + 核心摘要 + 分点论述/行动项」，适合会议与课程。",
        "builtin": True,
        "system_prompt": (
            "你是一名会议纪要整理助手。请将以下【语音转写文本】整理为结构清晰的纪要：\n"
            "1. 顶部给出一级标题\n"
            "2. 随后是“核心摘要”段落（基于原文，不新增信息）\n"
            "3. 主体按逻辑分点论述：列举用条目，步骤用序号，观点用段落\n"
            "4. 如包含待办事项，单列“行动项”\n"
            "删除口语化和无意义重复，修正识别错误，保留原有内容。"
            + _ANTI_HALLUCINATION
            + _OUTPUT_RULES
        ),
    },
    {
        "id": "minimal",
        "name": "极简实用",
        "description": "快速整理、批量处理，去冗余使其通顺易读。",
        "builtin": True,
        "system_prompt": (
            "请在不改变原意的前提下，整理、修正并优化以下语音转写文本，"
            "删除口语冗余，使其通顺易读。"
            + _ANTI_HALLUCINATION
            + _OUTPUT_RULES
        ),
    },
]

_BUILTIN_IDS = {p["id"] for p in BUILTIN_PRESETS}
_lock = threading.RLock()


# ───────── 预设 ─────────
def _load_user_presets() -> list[dict[str, Any]]:
    path = settings.prompts_path
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def _save_user_presets(presets: list[dict[str, Any]]) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.prompts_path.write_text(
        json.dumps(presets, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def list_presets() -> list[dict[str, Any]]:
    with _lock:
        return [dict(p) for p in BUILTIN_PRESETS] + _load_user_presets()


def get_preset(preset_id: str) -> dict[str, Any] | None:
    for preset in list_presets():
        if preset["id"] == preset_id:
            return preset
    return None


def create_preset(name: str, description: str, system_prompt: str) -> dict[str, Any]:
    with _lock:
        presets = _load_user_presets()
        preset = {
            "id": f"p_{uuid4().hex[:8]}",
            "name": name,
            "description": description,
            "builtin": False,
            "system_prompt": system_prompt,
        }
        presets.append(preset)
        _save_user_presets(presets)
        return preset


def update_preset(preset_id: str, name: str, description: str, system_prompt: str) -> dict[str, Any]:
    if preset_id in _BUILTIN_IDS:
        raise ValueError("builtin preset cannot be modified")
    with _lock:
        presets = _load_user_presets()
        for preset in presets:
            if preset["id"] == preset_id:
                preset.update(name=name, description=description, system_prompt=system_prompt)
                _save_user_presets(presets)
                return preset
    raise KeyError(preset_id)


def delete_preset(preset_id: str) -> None:
    if preset_id in _BUILTIN_IDS:
        raise ValueError("builtin preset cannot be deleted")
    with _lock:
        presets = _load_user_presets()
        remaining = [p for p in presets if p["id"] != preset_id]
        if len(remaining) == len(presets):
            raise KeyError(preset_id)
        _save_user_presets(remaining)


# ───────── 术语词典 ─────────
def load_glossary() -> dict[str, Any]:
    path = settings.glossary_path
    if not path.exists():
        return {"hotwords": [], "corrections": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"hotwords": [], "corrections": []}
    hotwords = data.get("hotwords") or []
    corrections = data.get("corrections") or []
    return {"hotwords": list(hotwords), "corrections": list(corrections)}


def save_glossary(hotwords: list[str], corrections: list[dict]) -> dict[str, Any]:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    payload = {"hotwords": hotwords, "corrections": corrections}
    settings.glossary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return payload


def glossary_prompt_section(glossary: dict[str, Any]) -> str:
    corrections = glossary.get("corrections") or []
    hotwords = glossary.get("hotwords") or []
    parts: list[str] = []
    if corrections:
        lines = "\n".join(f"- {c.get('wrong', '')} → {c.get('right', '')}" for c in corrections)
        parts.append(
            "术语纠错词典（将左侧误识写法纠正为右侧标准写法，仅在高置信时替换）：\n" + lines
        )
    if hotwords:
        parts.append("领域热词（优先正确识别与保留）：" + "、".join(hotwords))
    if not parts:
        return ""
    return "\n\n" + "\n\n".join(parts)


def combine_hotwords(glossary: dict[str, Any], extra: str = "") -> str:
    words: list[str] = list(glossary.get("hotwords") or [])
    if settings.stt_hotword:
        words.extend(w.strip() for w in settings.stt_hotword.split() if w.strip())
    if extra:
        words.extend(w.strip() for w in extra.replace("，", ",").split(",") if w.strip())
    seen: set[str] = set()
    unique: list[str] = []
    for word in words:
        if word and word not in seen:
            seen.add(word)
            unique.append(word)
    return " ".join(unique)