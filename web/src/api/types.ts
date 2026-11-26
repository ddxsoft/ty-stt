/**
 * ty-stt API 类型 —— 严格对应 docs/api-contract.md (v1)。
 * 前端所有 API 类型集中在此文件。
 */

// ───────── Transcriptions ─────────
export type TaskStatus =
  | 'queued'
  | 'preprocessing'
  | 'transcribing'
  | 'polishing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface Task {
  task_id: string
  filename: string
  status: TaskStatus
  /** 0-100 */
  progress: number
  stage_message: string
  folder: string
  preset: string
  doc_id: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface Segment {
  id: number
  start_ms: number
  end_ms: number
  text: string
}

/** SSE `segment` 事件 */
export interface TaskSegmentEvent {
  task_id: string
  id: number
  start_ms: number
  end_ms: number
  text: string
}

/** SSE `delta` 事件 */
export interface TaskDeltaEvent {
  task_id: string
  text: string
}

export interface CreateTranscriptionOptions {
  folder?: string
  /** preset id；`none` = 仅原始转写 */
  preset?: string
  /** 逗号分隔 */
  hotwords?: string
  /** 仅单文件时有意义 */
  title?: string
}

// ───────── Documents ─────────
export interface DocumentSummary {
  doc_id: string
  title: string
  path: string
  folder: string
  tags: string[]
  created_at: string
  updated_at: string
  duration_seconds: number
  has_audio: boolean
  has_transcript: boolean
  snippet: string
  char_count: number
}

export interface DocumentDetail extends DocumentSummary {
  /** 正文（不含 frontmatter） */
  content: string
  frontmatter: Record<string, unknown>
  segments: Segment[]
  raw_transcript: string
}

export interface ListDocumentsParams {
  folder?: string
  q?: string
  tag?: string
}

export interface UpdateDocumentBody {
  content: string
  title?: string
  tags?: string[]
}

export interface MoveDocumentBody {
  folder?: string
  filename?: string
}

export interface Snapshot {
  snapshot_id: string
  created_at: string
  char_count: number
  reason: string
}

export type ExportFormat = 'md' | 'txt'

// ───────── Folders ─────────
export interface FolderNode {
  name: string
  path: string
  doc_count: number
  children: FolderNode[]
}

// ───────── Presets / Prompts ─────────
export interface Preset {
  id: string
  name: string
  description: string
  builtin: boolean
  system_prompt: string
}

export interface PresetInput {
  name: string
  description: string
  system_prompt: string
}

// ───────── Polish (SSE over POST) ─────────
export type PolishSource = 'transcript' | 'current'

export interface PolishDocumentBody {
  doc_id: string
  preset: string
  source: PolishSource
}

export type SelectionAction = 'polish' | 'fix' | 'shorten' | 'list' | 'table' | 'formal' | 'verify'

export interface PolishSelectionBody {
  doc_id?: string
  selection: string
  action?: SelectionAction
  instruction?: string
  before?: string
  after?: string
}

export interface PolishTitleResult {
  title: string
  tags: string[]
}

// ───────── Settings ─────────
export type SttEngine = 'funasr' | 'mock'
export type SttDevice = 'cpu' | 'cuda'

export interface Settings {
  llm: {
    base_url: string
    api_key_set: boolean
    model: string
    temperature: number
  }
  stt: {
    engine: SttEngine
    device: SttDevice
    language: string
    vad: boolean
  }
  storage: {
    output_dir: string
  }
  default_preset: string
}

export interface SettingsUpdate {
  llm?: Partial<{
    base_url: string
    /** 仅写入，从不返回 */
    api_key: string
    model: string
    temperature: number
  }>
  stt?: Partial<Settings['stt']>
  storage?: Partial<Settings['storage']>
  default_preset?: string
}

export interface TestLlmResult {
  ok: boolean
  message: string
  models: string[]
}

export interface Glossary {
  hotwords: string[]
  corrections: { wrong: string; right: string }[]
}

export interface Health {
  status: string
  app: string
  version: string
  timestamp: string
  stt_engine: string
  llm_model: string
}

// ───────── Error ─────────
export interface ApiErrorBody {
  error: { code: string; message: string }
}
