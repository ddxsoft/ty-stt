# ty-stt API Contract (v1)

Base: `/api/v1` (Vite dev proxy / `VITE_API_BASE_URL`). JSON everywhere unless noted.
Errors: HTTP 4xx/5xx with body `{"error": {"code": str, "message": str}}`.
Timestamps: ISO-8601 strings. `doc_id` is stable (stored in the .md Frontmatter), `path` is a POSIX path relative to the output root, e.g. `课程笔记/2026-11-26_xxx.md`.

## Types

```ts
type TaskStatus = 'queued'|'preprocessing'|'transcribing'|'polishing'|'completed'|'failed'|'cancelled'
interface Task { task_id: string; filename: string; status: TaskStatus; progress: number /*0-100*/;
  stage_message: string; folder: string; preset: string; doc_id: string|null; error: string|null;
  created_at: string; updated_at: string }
interface Segment { id: number; start_ms: number; end_ms: number; text: string }
interface DocumentSummary { doc_id: string; title: string; path: string; folder: string; tags: string[];
  created_at: string; updated_at: string; duration_seconds: number; has_audio: boolean;
  has_transcript: boolean; snippet: string; char_count: number }
interface DocumentDetail extends DocumentSummary { content: string /*body, no frontmatter*/;
  frontmatter: Record<string, unknown>; segments: Segment[]; raw_transcript: string }
interface FolderNode { name: string; path: string; doc_count: number; children: FolderNode[] }
interface Preset { id: string; name: string; description: string; builtin: boolean; system_prompt: string }
interface Snapshot { snapshot_id: string; created_at: string; char_count: number; reason: string }
```

## Transcriptions
- `POST /transcriptions` multipart: `files` (1..n, field repeated), `folder` (str, default ""), `preset` (preset id, default `medium`; `none` = raw transcript only), `hotwords` (comma-separated str, optional), `title` (optional, only meaningful for a single file). → `{ "tasks": Task[] }` (HTTP 202)
- `GET /transcriptions` → `Task[]` (newest first)
- `GET /transcriptions/{task_id}` → `Task`
- `POST /transcriptions/{task_id}/cancel` → `Task`
- `POST /transcriptions/{task_id}/retry` → `Task`
- `DELETE /transcriptions/{task_id}` → 204 (only finished tasks)
- `GET /transcriptions/stream` — **SSE**, global. Events (each `data:` is JSON):
  - `task`  → `Task` (any status/progress change)
  - `segment` → `{task_id, id, start_ms, end_ms, text}` (live STT segment)
  - `delta` → `{task_id, text}` (live LLM polish token chunk)
  - `ping` every 15s

## Documents
- `GET /documents?folder=&q=&tag=` → `DocumentSummary[]` (folder is recursive; `q` searches title/tags/body)
- `GET /documents/{doc_id}` → `DocumentDetail`
- `PUT /documents/{doc_id}` body `{content: string, title?: string, tags?: string[]}` → `DocumentDetail` (server snapshots previous content automatically)
- `DELETE /documents/{doc_id}` → 204
- `POST /documents/{doc_id}/move` body `{folder?: string, filename?: string}` → `DocumentDetail`
- `GET /documents/{doc_id}/snapshots` → `Snapshot[]`
- `GET /documents/{doc_id}/snapshots/{snapshot_id}` → `{content: string}`
- `POST /documents/{doc_id}/snapshots/{snapshot_id}/restore` → `DocumentDetail`
- `GET /documents/{doc_id}/export?format=md|txt` → file download
- `GET /audio/{doc_id}` → audio stream, supports `Range` (use as `<audio src>`)

## Folders
- `GET /folders` → `FolderNode` (root node, `path: ""`)
- `POST /folders` body `{path}` → `FolderNode`
- `PATCH /folders` body `{path, new_name}` → `FolderNode`
- `DELETE /folders?path=&force=false` → 204

## AI Polish (SSE over POST — consume with `fetch` + ReadableStream; events `delta`, `done`, `error`)
- `POST /polish/document` body `{doc_id, preset: string, source: 'transcript'|'current'}` → events `delta {text}`; `done {content}`; `error {message}`. Does NOT save; client previews/diffs then `PUT`s.
- `POST /polish/selection` body `{doc_id?: string, selection: string, action?: 'polish'|'fix'|'shorten'|'list'|'table'|'formal'|'verify', instruction?: string, before?: string, after?: string}` → same events; `done {content}` is the replacement text for the selection. `verify` cross-checks against the raw transcript of `doc_id`.
- `POST /polish/title` body `{content}` → `{title: string, tags: string[]}`

## Settings
- `GET /settings` → `{llm:{base_url, api_key_set: boolean, model, temperature}, stt:{engine:'funasr'|'mock', device:'cpu'|'cuda', language, vad: boolean}, storage:{output_dir: string}, default_preset: string}`
- `PUT /settings` body: partial of the same shape (`llm.api_key` string accepted, never returned) → same as GET
- `POST /settings/test-llm` → `{ok: boolean, message: string, models: string[]}`
- `GET /prompts` → `Preset[]`; `POST /prompts` `{name, description, system_prompt}` → `Preset`; `PUT /prompts/{id}`; `DELETE /prompts/{id}` (non-builtin only)
- `GET /glossary` → `{hotwords: string[], corrections: {wrong: string, right: string}[]}`; `PUT /glossary` same body
- `GET /health` → `{status, app, version, timestamp, stt_engine, llm_model}`
