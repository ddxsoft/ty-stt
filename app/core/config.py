"""ty-stt 配置体系。

环境变量前缀 TYSTT_*，兼容回退读取旧 TYVOICE_*。
运行时可编辑项（LLM / STT / 输出目录 / 默认预设）持久化到
``{data_dir}/runtime_config.json``，覆盖环境变量默认值。
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# 加载项目根 .env（不覆盖已存在的环境变量，测试/CLI 显式设置优先）
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env", override=False)


def _env(name: str, legacy: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or value == "":
        value = os.getenv(legacy)
    if value is None or value == "":
        value = default
    return value


def _env_bool(name: str, legacy: str, default: bool) -> bool:
    return _env(name, legacy, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, legacy: str, default: int) -> int:
    try:
        return int(_env(name, legacy, str(default)))
    except ValueError:
        return default


def _env_float(name: str, legacy: str, default: float) -> float:
    try:
        return float(_env(name, legacy, str(default)))
    except ValueError:
        return default


# 运行时可编辑字段（写入 runtime_config.json）
_RUNTIME_FIELDS = (
    "llm_base_url",
    "llm_api_key",
    "llm_model",
    "llm_temperature",
    "stt_engine",
    "stt_device",
    "stt_language",
    "stt_vad",
    "output_dir",
    "default_preset",
)


@dataclass
class Settings:
    app_name: str = field(default_factory=lambda: _env("TYSTT_APP_NAME", "TYVOICE_APP_NAME", "ty-stt"))
    app_version: str = field(default_factory=lambda: _env("TYSTT_APP_VERSION", "TYVOICE_APP_VERSION", "1.0.0"))
    env: str = field(default_factory=lambda: _env("TYSTT_ENV", "TYVOICE_ENV", "local"))
    log_level: str = field(default_factory=lambda: _env("TYSTT_LOG_LEVEL", "TYVOICE_LOG_LEVEL", "INFO"))

    data_dir: Path = field(default_factory=lambda: Path(_env("TYSTT_DATA_DIR", "TYVOICE_DATA_DIR", "data")))
    output_dir: Path = field(default_factory=lambda: Path(_env("TYSTT_OUTPUT_DIR", "", "workspace")))

    # STT
    stt_engine: str = field(default_factory=lambda: _env("TYSTT_STT_ENGINE", "TYVOICE_STT_MODE", "funasr"))
    stt_model: str = field(default_factory=lambda: _env("TYSTT_STT_MODEL", "TYVOICE_STT_MODEL", "FunAudioLLM/Fun-ASR-Nano-2512"))
    stt_model_path: str = field(default_factory=lambda: _env("TYSTT_STT_MODEL_PATH", "TYVOICE_STT_MODEL_PATH", ""))
    stt_device: str = field(default_factory=lambda: _env("TYSTT_STT_DEVICE", "TYVOICE_STT_DEVICE", "cpu"))
    stt_fp16: bool = field(default_factory=lambda: _env_bool("TYSTT_STT_FP16", "TYVOICE_STT_FP16", False))
    stt_batch_size_s: int = field(default_factory=lambda: _env_int("TYSTT_STT_BATCH_SIZE_S", "TYVOICE_STT_BATCH_SIZE_S", 30))
    stt_hotword: str = field(default_factory=lambda: _env("TYSTT_STT_HOTWORD", "TYVOICE_STT_HOTWORD", ""))
    stt_language: str = field(default_factory=lambda: _env("TYSTT_STT_LANGUAGE", "TYVOICE_STT_LANGUAGE", "zh"))
    stt_vad: bool = field(default_factory=lambda: _env_bool("TYSTT_STT_VAD", "", True))
    stt_vad_model: str = field(default_factory=lambda: _env("TYSTT_STT_VAD_MODEL", "", "fsmn-vad"))
    stt_punc_model: str = field(default_factory=lambda: _env("TYSTT_STT_PUNC_MODEL", "", "ct-punc"))
    stt_vad_merge_ms: int = field(default_factory=lambda: _env_int("TYSTT_STT_VAD_MERGE_MS", "", 2000))
    stt_window_seconds: float = field(default_factory=lambda: _env_float("TYSTT_STT_WINDOW_SECONDS", "", 45.0))
    stt_fine_align: bool = field(default_factory=lambda: _env_bool("TYSTT_STT_FINE_ALIGN", "", False))
    stt_segment_seconds: float = field(default_factory=lambda: _env_float("TYSTT_STT_SEGMENT_SECONDS", "TYVOICE_STT_SEGMENT_SECONDS", 30.0))

    # LLM (OpenAI-Compatible)
    llm_base_url: str = field(default_factory=lambda: _env("TYSTT_LLM_BASE_URL", "TYVOICE_OLLAMA_BASE_URL", "http://localhost:11434/v1"))
    llm_api_key: str = field(default_factory=lambda: _env("TYSTT_LLM_API_KEY", "TYVOICE_OLLAMA_API_KEY", "ollama"))
    llm_model: str = field(default_factory=lambda: _env("TYSTT_LLM_MODEL", "TYVOICE_OLLAMA_MODEL", "qwen3:8b"))
    llm_temperature: float = field(default_factory=lambda: _env_float("TYSTT_LLM_TEMPERATURE", "", 0.3))

    default_preset: str = field(default_factory=lambda: _env("TYSTT_DEFAULT_PRESET", "", "medium"))
    max_concurrent_tasks: int = field(default_factory=lambda: _env_int("TYSTT_MAX_CONCURRENT_TASKS", "", 1))
    polish_chunk_chars: int = field(default_factory=lambda: _env_int("TYSTT_POLISH_CHUNK_CHARS", "", 2500))
    polish_context_chars: int = field(default_factory=lambda: _env_int("TYSTT_POLISH_CONTEXT_CHARS", "", 200))

    cors_origins: list[str] = field(
        default_factory=lambda: [
            origin.strip()
            for origin in _env(
                "TYSTT_CORS_ORIGINS",
                "TYVOICE_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]
    )

    def __post_init__(self) -> None:
        self.data_dir = Path(self.data_dir)
        self.output_dir = Path(self.output_dir)
        self._lock = threading.RLock()
        self._apply_runtime_overrides()

    # ── 路径助手 ──
    @property
    def runtime_config_path(self) -> Path:
        return self.data_dir / "runtime_config.json"

    @property
    def audio_dir(self) -> Path:
        return self.data_dir / "audio"

    @property
    def transcripts_dir(self) -> Path:
        return self.data_dir / "transcripts"

    @property
    def snapshots_dir(self) -> Path:
        return self.data_dir / "snapshots"

    @property
    def prompts_path(self) -> Path:
        return self.data_dir / "prompts.json"

    @property
    def glossary_path(self) -> Path:
        return self.data_dir / "glossary.json"

    @property
    def tasks_path(self) -> Path:
        return self.data_dir / "tasks.json"

    @property
    def doc_index_path(self) -> Path:
        return self.data_dir / "doc_index.json"

    def ensure_dirs(self) -> None:
        for path in (
            self.data_dir,
            self.output_dir,
            self.audio_dir,
            self.transcripts_dir,
            self.snapshots_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)

    # ── 运行时持久化 ──
    def _apply_runtime_overrides(self) -> None:
        path = self.runtime_config_path
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        for key in _RUNTIME_FIELDS:
            if key not in data:
                continue
            value = data[key]
            if key == "output_dir":
                self.output_dir = Path(value)
            else:
                setattr(self, key, value)

    def update_runtime(self, changes: dict) -> None:
        """更新运行时可编辑字段并持久化。未知字段忽略。"""
        with self._lock:
            for key, value in changes.items():
                if key not in _RUNTIME_FIELDS:
                    continue
                if key == "output_dir":
                    self.output_dir = Path(value)
                else:
                    setattr(self, key, value)
            self._persist_runtime()

    def _persist_runtime(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        payload = {}
        for key in _RUNTIME_FIELDS:
            value = getattr(self, key)
            payload[key] = str(value) if isinstance(value, Path) else value
        self.runtime_config_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )


settings = Settings()