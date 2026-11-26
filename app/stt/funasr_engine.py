"""FunASR 引擎：VAD 智能端点分段 + 真实时间戳 + 热词注入 + OOM 自适应回退。

默认模型 Fun-ASR-Nano（LLM-ASR）。启用 VAD（fsmn-vad）时按真实语音停顿切分，
逐段转写得到带时间戳的 segments；VAD 不可用时回退整段转写（单段覆盖全时长）。
"""

from __future__ import annotations

import asyncio
import os
import threading
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.core.logging import get_logger
from app.stt.audio_proc import normalize_to_wav, probe_audio, slice_wav
from app.stt.base import BaseSTTEngine, SegmentCallback, TranscriptResult, TranscriptSegment

logger = get_logger(__name__)

_asr_lock = threading.Lock()
_asr_instance: Any = None
_asr_fp16: bool | None = None
_asr_device: str | None = None
_vad_lock = threading.Lock()
_vad_instance: Any = None


def _resolve_model_path() -> str:
    env_path = settings.stt_model_path or os.getenv("TYSTT_STT_MODEL_PATH") or os.getenv("TYVOICE_STT_MODEL_PATH")
    if env_path:
        path = Path(env_path)
        if path.exists():
            return str(path)
    default_cache = (
        Path.home() / ".cache" / "modelscope" / "hub" / "models" / "FunAudioLLM" / "Fun-ASR-Nano-2512"
    )
    if default_cache.exists():
        return str(default_cache)
    return settings.stt_model


def _ensure_registry() -> None:
    try:
        import funasr.models.fun_asr_nano.model  # noqa: F401
        import funasr.models.sense_voice.model  # noqa: F401
        import funasr.models.llm_asr.adaptor  # noqa: F401
        import funasr.models.transformer.decoder  # noqa: F401
        import funasr.frontends.wav_frontend  # noqa: F401
        import funasr.tokenizer.hf_tokenizer  # noqa: F401
    except Exception as exc:  # pragma: no cover - 依赖环境
        raise RuntimeError("failed to initialize funasr registry") from exc


def _patch_llm_generate(model: Any) -> None:
    import torch

    llm = getattr(getattr(model, "model", None), "llm", None)
    if llm is None or getattr(llm, "_tystt_generate_patched", False):
        return
    original_generate = llm.generate
    pad_token_id = getattr(getattr(llm, "generation_config", None), "pad_token_id", None)
    if pad_token_id is None:
        pad_token_id = getattr(getattr(llm, "config", None), "pad_token_id", None)
    if pad_token_id is None:
        eos = getattr(getattr(llm, "generation_config", None), "eos_token_id", None)
        if eos is None:
            eos = getattr(getattr(llm, "config", None), "eos_token_id", None)
        if eos is not None:
            pad_token_id = eos[0] if isinstance(eos, (list, tuple)) else eos
        if hasattr(llm, "generation_config"):
            llm.generation_config.pad_token_id = pad_token_id

    def generate_with_mask(*args: Any, **kwargs: Any) -> Any:
        if "attention_mask" not in kwargs:
            inputs_embeds = kwargs.get("inputs_embeds")
            if inputs_embeds is not None:
                kwargs["attention_mask"] = torch.ones(
                    inputs_embeds.shape[:-1], dtype=torch.long, device=inputs_embeds.device
                )
        if "pad_token_id" not in kwargs and pad_token_id is not None:
            kwargs["pad_token_id"] = pad_token_id
        return original_generate(*args, **kwargs)

    llm.generate = generate_with_mask
    llm._tystt_generate_patched = True


def _load_asr(fp16: bool | None = None) -> Any:
    global _asr_instance, _asr_fp16, _asr_device
    desired_fp16 = settings.stt_fp16 if fp16 is None else fp16
    desired_device = settings.stt_device
    if desired_device == "cpu":
        desired_fp16 = False
    with _asr_lock:
        if _asr_instance is None or _asr_fp16 != desired_fp16 or _asr_device != desired_device:
            try:
                from funasr import AutoModel
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError("funasr is not installed") from exc
            _ensure_registry()
            _asr_instance = AutoModel(
                model=_resolve_model_path(),
                device=desired_device,
                fp16=desired_fp16,
                trust_remote_code=False,
                disable_update=True,
            )
            _asr_fp16 = desired_fp16
            _asr_device = desired_device
    _patch_llm_generate(_asr_instance)
    return _asr_instance


def _load_vad() -> Any:
    global _vad_instance
    with _vad_lock:
        if _vad_instance is None:
            from funasr import AutoModel

            _vad_instance = AutoModel(model=settings.stt_vad_model, disable_update=True)
    return _vad_instance


def _extract_text(result: Any) -> str:
    if isinstance(result, list) and result:
        first = result[0]
        if isinstance(first, dict) and "text" in first:
            return str(first["text"]).strip()
    if isinstance(result, dict) and "text" in result:
        return str(result["text"]).strip()
    return ""


def _run_vad(wav_path: Path) -> list[tuple[int, int]]:
    vad = _load_vad()
    result = vad.generate(input=str(wav_path))
    segments: list[tuple[int, int]] = []
    items = result if isinstance(result, list) else [result]
    for item in items:
        if not isinstance(item, dict):
            continue
        value = item.get("value") or item.get("text") or []
        for pair in value:
            if isinstance(pair, (list, tuple)) and len(pair) >= 2:
                start, end = int(pair[0]), int(pair[1])
                if end > start:
                    segments.append((start, end))
    return segments


def _is_oom(message: str) -> bool:
    lowered = message.lower()
    return "out of memory" in lowered or "not enough memory" in lowered


def _merge_short_spans(spans: list[tuple[int, int]], min_ms: int) -> list[tuple[int, int]]:
    """把短于 min_ms 的碎片段并入相邻段，避免孤立转写丢失上下文。"""
    merged: list[tuple[int, int]] = []
    for start, end in spans:
        short = (end - start) < min_ms
        if merged and (short or (merged[-1][1] - merged[-1][0]) < min_ms):
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def _group_windows(spans: list[tuple[int, int]], window_ms: int) -> list[list[tuple[int, int]]]:
    """把相邻段聚合成上下文窗口（累计时长达到 window_ms 即成窗），整窗转写保精度。"""
    windows: list[list[tuple[int, int]]] = []
    current: list[tuple[int, int]] = []
    for span in spans:
        current.append(span)
        if current[-1][1] - current[0][0] >= window_ms:
            windows.append(current)
            current = []
    if current:
        windows.append(current)
    return windows


def _align_text_to_spans(
    text: str, spans: list[tuple[int, int]], window_start: int, window_end: int
) -> list[tuple[int, int, str]]:
    """可选近似细对齐：按段时长比例把整窗文本拆回各 VAD 段（时间戳真实，文本为近似分配）。"""
    total = max(1, window_end - window_start)
    chars = list(text)
    count = len(chars)
    result: list[tuple[int, int, str]] = []
    pos = 0
    for index, (start, end) in enumerate(spans):
        if index == len(spans) - 1:
            portion = chars[pos:]
        else:
            take = round(count * (end - start) / total)
            portion = chars[pos:pos + take]
            pos += take
        seg_text = "".join(portion).strip()
        if seg_text:
            result.append((start, end, seg_text))
    return result


def _generate(model: Any, wav_path: Path, hotwords: str) -> str:
    result = model.generate(
        input=str(wav_path),
        batch_size_s=settings.stt_batch_size_s,
        hotword=hotwords or settings.stt_hotword,
    )
    return _extract_text(result)


def _transcribe_span(
    model: Any,
    norm_wav: Path,
    start_ms: int,
    end_ms: int,
    hotwords: str,
    work_dir: Path,
    depth: int = 0,
) -> str:
    """转写一个时间区间，OOM 时递归二分（最小约 3 秒）。"""
    slice_path = work_dir / f"span_{uuid4().hex}.wav"
    slice_wav(norm_wav, slice_path, start_ms, end_ms)
    try:
        try:
            return _generate(model, slice_path, hotwords)
        except RuntimeError as exc:
            message = str(exc)
            span = end_ms - start_ms
            if _is_oom(message) and span > 3000 and depth < 6:
                mid = start_ms + span // 2
                left = _transcribe_span(model, norm_wav, start_ms, mid, hotwords, work_dir, depth + 1)
                right = _transcribe_span(model, norm_wav, mid, end_ms, hotwords, work_dir, depth + 1)
                return (left + right).strip()
            if settings.stt_fp16 and "expected scalar type" in message and "Half" in message:
                model = _load_asr(fp16=False)
                return _generate(model, slice_path, hotwords)
            raise
    finally:
        slice_path.unlink(missing_ok=True)


class FunASREngine(BaseSTTEngine):
    async def transcribe(
        self,
        audio_path: Path,
        *,
        hotwords: str = "",
        on_segment: SegmentCallback | None = None,
    ) -> TranscriptResult:
        return await asyncio.to_thread(self._run, audio_path, hotwords, on_segment)

    def _run(self, audio_path: Path, hotwords: str, on_segment: SegmentCallback | None) -> TranscriptResult:
        info = probe_audio(audio_path)
        duration_ms = int(info.duration_seconds * 1000)
        work_dir = settings.audio_dir / "segments"
        work_dir.mkdir(parents=True, exist_ok=True)
        norm_wav = settings.audio_dir / f"{audio_path.stem}_{uuid4().hex[:6]}.stt.wav"
        normalize_to_wav(audio_path, norm_wav)
        try:
            model = _load_asr()
            vad_spans: list[tuple[int, int]] | None = None
            if settings.stt_vad:
                try:
                    vad_spans = _run_vad(norm_wav)
                except Exception as exc:  # pragma: no cover - 模型环境
                    logger.warning("VAD failed, fallback to whole-file: %s", exc)
                    vad_spans = None
            segments: list[TranscriptSegment] = []
            if vad_spans:
                merged = _merge_short_spans(vad_spans, settings.stt_vad_merge_ms)
                windows = _group_windows(merged, int(settings.stt_window_seconds * 1000))
                for window in windows:
                    w_start, w_end = window[0][0], window[-1][1]
                    text = _transcribe_span(model, norm_wav, w_start, w_end, hotwords, work_dir)
                    if not text:
                        continue
                    if settings.stt_fine_align and len(window) > 1:
                        for start_ms, end_ms, seg_text in _align_text_to_spans(text, window, w_start, w_end):
                            segment = TranscriptSegment(len(segments), start_ms, end_ms, seg_text)
                            segments.append(segment)
                            if on_segment:
                                on_segment(segment)
                    else:
                        segment = TranscriptSegment(len(segments), w_start, w_end, text)
                        segments.append(segment)
                        if on_segment:
                            on_segment(segment)
            else:
                text = _transcribe_span(model, norm_wav, 0, max(duration_ms, 1), hotwords, work_dir)
                segment = TranscriptSegment(0, 0, duration_ms, text)
                segments.append(segment)
                if on_segment:
                    on_segment(segment)
            joiner = "" if settings.stt_language.startswith("zh") else " "
            full_text = joiner.join(s.text for s in segments).strip()
            return TranscriptResult(
                language=settings.stt_language,
                text=full_text,
                segments=segments,
                duration_seconds=info.duration_seconds,
            )
        finally:
            norm_wav.unlink(missing_ok=True)