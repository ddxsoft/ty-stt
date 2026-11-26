"""ty-stt Pydantic 请求/响应模型，严格对应 docs/api-contract.md。"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

TaskStatus = Literal[
    "queued", "preprocessing", "transcribing", "polishing", "completed", "failed", "cancelled"
]


# ───────── Transcriptions ─────────
class Task(BaseModel):
    task_id: str
    filename: str
    status: TaskStatus = "queued"
    progress: int = 0
    stage_message: str = ""
    folder: str = ""
    preset: str = "medium"
    doc_id: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


class CreateTasksResponse(BaseModel):
    tasks: list[Task]


class Segment(BaseModel):
    id: int
    start_ms: int
    end_ms: int
    text: str


# ───────── Documents ─────────
class DocumentSummary(BaseModel):
    doc_id: str
    title: str
    path: str
    folder: str
    tags: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str
    duration_seconds: float = 0.0
    has_audio: bool = False
    has_transcript: bool = False
    snippet: str = ""
    char_count: int = 0


class DocumentDetail(DocumentSummary):
    content: str
    frontmatter: dict[str, Any] = Field(default_factory=dict)
    segments: list[Segment] = Field(default_factory=list)
    raw_transcript: str = ""


class UpdateDocumentBody(BaseModel):
    content: str
    title: str | None = None
    tags: list[str] | None = None


class MoveDocumentBody(BaseModel):
    folder: str | None = None
    filename: str | None = None


class Snapshot(BaseModel):
    snapshot_id: str
    created_at: str
    char_count: int
    reason: str = ""


class SnapshotContent(BaseModel):
    content: str


# ───────── Folders ─────────
class FolderNode(BaseModel):
    name: str
    path: str
    doc_count: int = 0
    children: list["FolderNode"] = Field(default_factory=list)


class CreateFolderBody(BaseModel):
    path: str


class RenameFolderBody(BaseModel):
    path: str
    new_name: str


# ───────── Presets / Prompts ─────────
class Preset(BaseModel):
    id: str
    name: str
    description: str = ""
    builtin: bool = False
    system_prompt: str = ""


class PresetInput(BaseModel):
    name: str
    description: str = ""
    system_prompt: str


# ───────── Polish ─────────
class PolishDocumentBody(BaseModel):
    doc_id: str
    preset: str = "medium"
    source: Literal["transcript", "current"] = "transcript"


class PolishSelectionBody(BaseModel):
    doc_id: str | None = None
    selection: str
    action: Literal["polish", "fix", "shorten", "list", "table", "formal", "verify"] | None = None
    instruction: str | None = None
    before: str | None = None
    after: str | None = None


class PolishTitleBody(BaseModel):
    content: str


class PolishTitleResult(BaseModel):
    title: str
    tags: list[str] = Field(default_factory=list)


# ───────── Settings ─────────
class LlmSettings(BaseModel):
    base_url: str
    api_key_set: bool
    model: str
    temperature: float


class SttSettings(BaseModel):
    engine: Literal["funasr", "mock"] = "funasr"
    device: Literal["cpu", "cuda"] = "cpu"
    language: str = "zh"
    vad: bool = True


class StorageSettings(BaseModel):
    output_dir: str


class SettingsResponse(BaseModel):
    llm: LlmSettings
    stt: SttSettings
    storage: StorageSettings
    default_preset: str


class LlmSettingsUpdate(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None
    temperature: float | None = None


class SttSettingsUpdate(BaseModel):
    engine: Literal["funasr", "mock"] | None = None
    device: Literal["cpu", "cuda"] | None = None
    language: str | None = None
    vad: bool | None = None


class StorageSettingsUpdate(BaseModel):
    output_dir: str | None = None


class SettingsUpdate(BaseModel):
    llm: LlmSettingsUpdate | None = None
    stt: SttSettingsUpdate | None = None
    storage: StorageSettingsUpdate | None = None
    default_preset: str | None = None


class TestLlmResult(BaseModel):
    ok: bool
    message: str
    models: list[str] = Field(default_factory=list)


class Correction(BaseModel):
    wrong: str
    right: str


class Glossary(BaseModel):
    hotwords: list[str] = Field(default_factory=list)
    corrections: list[Correction] = Field(default_factory=list)


class Health(BaseModel):
    status: str
    app: str
    version: str
    timestamp: str
    stt_engine: str
    llm_model: str


FolderNode.model_rebuild()