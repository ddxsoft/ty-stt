"""一次性迁移：旧 data/docs/*.md（剥离 think 块）+ 元数据/转写 → 新文件结构。

用法（项目根目录）：
    python scripts/migrate_legacy.py [--folder 未分类] [--dry-run]

- Markdown 输出到 {TYSTT_OUTPUT_DIR}/{folder}/{date}_{title}.md，保留原 doc_id 与 Frontmatter。
- 旧 data/transcripts/{doc_id}.txt 转为 {doc_id}.json（segments 为空，旧实现无时间戳）。
- 音频仍位于 data/audio/{doc_id}.*，新侧车存储直接复用，无需移动。
- 幂等：已存在的 doc_id 跳过。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.llm.client import strip_think  # noqa: E402
from app.storage.markdown_store import get_store  # noqa: E402
from app.storage.sidecar_store import get_sidecar  # noqa: E402


def _derive_title(body: str, fallback: str) -> str:
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("# ").strip()[:60] or fallback
    for line in body.splitlines():
        if line.strip():
            return line.strip()[:60]
    return fallback


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder", default="未分类")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    settings.ensure_dirs()
    store = get_store()
    sidecar = get_sidecar()

    docs_dir = settings.data_dir / "docs"
    meta_dir = settings.data_dir / "metadata"
    transcripts_dir = settings.data_dir / "transcripts"
    if not docs_dir.exists():
        print("no legacy data/docs directory; nothing to migrate")
        return

    migrated, skipped = 0, 0
    for md_path in sorted(docs_dir.glob("*.md")):
        doc_id = md_path.stem
        if store.exists(doc_id):
            skipped += 1
            continue
        meta = {}
        meta_path = meta_dir / f"{doc_id}.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                meta = {}
        raw = md_path.read_text(encoding="utf-8")
        body = strip_think(raw)
        title = _derive_title(body, meta.get("original_filename") or doc_id)
        created_at = meta.get("created_at")
        duration = float(meta.get("audio_duration_seconds", 0.0) or 0.0)

        if args.dry_run:
            print(f"[dry-run] {doc_id} -> {args.folder}/{title} (chars={len(body)})")
            migrated += 1
            continue

        store.create(
            doc_id=doc_id,
            title=title,
            folder=args.folder,
            content=body,
            created_at=created_at,
            extra_meta={
                "source_audio": meta.get("original_filename", ""),
                "duration_seconds": duration,
                "stt_engine": "funasr",
                "polish_preset": "medium",
                "tags": [],
            },
        )
        txt_path = transcripts_dir / f"{doc_id}.txt"
        if txt_path.exists() and not sidecar.has_transcript(doc_id):
            text = txt_path.read_text(encoding="utf-8").strip()
            sidecar.save_transcript(doc_id, {"language": "zh", "text": text, "segments": [], "duration_seconds": duration})
        migrated += 1
        print(f"migrated {doc_id} -> {args.folder}/{title}")

    print(f"done: migrated={migrated}, skipped(existing)={skipped}, output_dir={settings.output_dir}")


if __name__ == "__main__":
    main()