"""STT 辅助逻辑单元测试：短段合并、窗口聚合、近似细对齐、WAV 切片。"""

from __future__ import annotations

import wave

from app.stt.audio_proc import slice_wav
from app.stt.funasr_engine import _align_text_to_spans, _group_windows, _merge_short_spans


def test_merge_short_spans_absorbs_fragments():
    spans = [(0, 5000), (5200, 5600), (6000, 12000)]  # 中间 400ms 碎片
    merged = _merge_short_spans(spans, 2000)
    assert merged == [(0, 5600), (6000, 12000)]  # 碎片并入前段，长段保留


def test_merge_short_spans_keeps_long():
    spans = [(0, 5000), (6000, 12000), (13000, 20000)]
    assert _merge_short_spans(spans, 2000) == spans


def test_merge_first_short_span():
    spans = [(0, 500), (1000, 8000)]
    assert _merge_short_spans(spans, 2000) == [(0, 8000)]


def test_group_windows_by_duration():
    spans = [(0, 10000), (10000, 20000), (20000, 30000), (30000, 40000)]
    windows = _group_windows(spans, 25000)
    assert len(windows) == 2
    assert windows[0][0][0] == 0
    assert windows[0][-1][1] == 30000
    assert windows[1][0][0] == 30000


def test_group_windows_single_long_span():
    windows = _group_windows([(0, 90000)], 45000)
    assert windows == [[(0, 90000)]]


def test_align_text_proportional():
    spans = [(0, 1000), (1000, 3000)]  # 1:2 时长比
    text = "一二三四五六七八九"  # 9 字
    aligned = _align_text_to_spans(text, spans, 0, 3000)
    assert aligned[0][0] == 0 and aligned[0][1] == 1000
    assert aligned[1][0] == 1000 and aligned[1][1] == 3000
    assert aligned[0][2] == "一二三"  # round(9*1/3)=3
    assert aligned[1][2] == "四五六七八九"  # 余下全部


def test_align_text_empty():
    assert _align_text_to_spans("", [(0, 1000)], 0, 1000) == []


def test_slice_wav_duration(tmp_path):
    src = tmp_path / "src.wav"
    with wave.open(str(src), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\x00\x00" * 16000 * 3)  # 3s
    dst = tmp_path / "slice.wav"
    slice_wav(src, dst, 1000, 2000)
    with wave.open(str(dst), "rb") as w:
        assert w.getnframes() == 16000  # 1s
        assert w.getframerate() == 16000