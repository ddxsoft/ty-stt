"""LLM think 剥离器与润色分块逻辑单元测试。"""

from __future__ import annotations

from app.agent.polish_agent import split_text
from app.llm.client import ThinkStreamFilter, strip_think


def test_strip_think_closed():
    assert strip_think("<think>推理过程</think>\n\n正文") == "正文"


def test_strip_think_unclosed():
    assert strip_think("正文前<think>未闭合推理") == "正文前"


def test_stream_filter_across_chunks():
    filt = ThinkStreamFilter()
    chunks = ["你好<thi", "nk>秘密推理</thi", "nk>世界"]
    out = "".join(filt.feed(c) for c in chunks) + filt.flush()
    assert out == "你好世界"


def test_stream_filter_unclosed_discards():
    filt = ThinkStreamFilter()
    out = "".join(filt.feed(c) for c in ["正文", "<think>还在想"]) + filt.flush()
    assert out == "正文"


def test_stream_filter_plain():
    filt = ThinkStreamFilter()
    out = "".join(filt.feed(c) for c in ["纯正文", "没有标签"]) + filt.flush()
    assert out == "纯正文没有标签"


def test_split_text_short():
    assert split_text("短文本", 2500) == ["短文本"]


def test_split_text_long_by_sentence():
    text = "这是第一句。" * 600  # 3600 字，超过 2500
    chunks = split_text(text, 2500)
    assert len(chunks) > 1
    assert all(len(c) <= 2500 for c in chunks)
    assert "".join(chunks) == text


def test_split_text_empty():
    assert split_text("   ", 2500) == []