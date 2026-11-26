"""文件系统 Markdown 直存：文件夹树、YAML Frontmatter、安全路径校验、文档索引。

文档即文件：``{output_dir}/{folder}/{date}_{title}.md``，头部嵌入 YAML Frontmatter，
``doc_id`` 稳定存于 Frontmatter，``path`` 为相对输出根的 POSIX 路径。
"""

from __future__ import annotations

import json
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from app.core.config import settings

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
_ILLEGAL_FILENAME = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def parse_frontmatter(raw: str) -> tuple[dict[str, Any], str]:
    """拆分 Frontmatter 与正文。无 Frontmatter 时返回 ({}, 原文)。"""
    text = raw.replace("\r\n", "\n")
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    try:
        meta = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        meta = {}
    if not isinstance(meta, dict):
        meta = {}
    body = text[match.end():]
    return meta, body


def dump_frontmatter(meta: dict[str, Any], body: str) -> str:
    header = yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, default_flow_style=False)
    return f"---\n{header}---\n\n{body.lstrip(chr(10))}"


def slugify_title(title: str, max_len: int = 60) -> str:
    cleaned = _ILLEGAL_FILENAME.sub("", title).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        cleaned = "未命名"
    return cleaned[:max_len].strip() or "未命名"


def make_snippet(body: str, limit: int = 120) -> str:
    text = re.sub(r"[#>*`_\-\[\]!]", "", body)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


@dataclass
class DocRecord:
    doc_id: str
    path: str
    folder: str
    title: str
    tags: list[str]
    created_at: str
    updated_at: str
    content: str
    frontmatter: dict[str, Any] = field(default_factory=dict)

    @property
    def duration_seconds(self) -> float:
        try:
            return float(self.frontmatter.get("duration_seconds", 0.0) or 0.0)
        except (TypeError, ValueError):
            return 0.0

    def summary(self, *, has_audio: bool, has_transcript: bool) -> dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "title": self.title,
            "path": self.path,
            "folder": self.folder,
            "tags": self.tags,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "duration_seconds": self.duration_seconds,
            "has_audio": has_audio,
            "has_transcript": has_transcript,
            "snippet": make_snippet(self.content),
            "char_count": len(self.content.strip()),
        }


class PathTraversalError(ValueError):
    pass


class DocumentNotFound(KeyError):
    pass


class MarkdownStore:
    def __init__(self, root: Path | None = None) -> None:
        self._lock = threading.RLock()
        self._root = Path(root) if root is not None else settings.output_dir
        self._root.mkdir(parents=True, exist_ok=True)
        self._index: dict[str, str] = {}
        self._index_loaded = False

    @property
    def root(self) -> Path:
        return self._root

    def reconfigure(self, root: Path) -> None:
        """输出目录在运行时被修改后重建索引。"""
        with self._lock:
            self._root = Path(root)
            self._root.mkdir(parents=True, exist_ok=True)
            self._index = {}
            self._index_loaded = False

    # ── 路径安全 ──
    def _resolve(self, rel: str) -> Path:
        rel = (rel or "").replace("\\", "/").strip("/")
        if ".." in rel.split("/"):
            raise PathTraversalError("path traversal detected")
        target = (self._root / rel).resolve()
        root_resolved = self._root.resolve()
        if target != root_resolved and root_resolved not in target.parents:
            raise PathTraversalError("path escapes output root")
        return target

    def _rel(self, path: Path) -> str:
        return path.resolve().relative_to(self._root.resolve()).as_posix()

    # ── 索引 ──
    def _ensure_index(self) -> None:
        if self._index_loaded:
            return
        with self._lock:
            if self._index_loaded:
                return
            self._index = {}
            for md in sorted(self._root.rglob("*.md")):
                try:
                    meta, _ = parse_frontmatter(md.read_text(encoding="utf-8"))
                except OSError:
                    continue
                doc_id = meta.get("doc_id")
                if isinstance(doc_id, str) and doc_id:
                    self._index[doc_id] = self._rel(md)
            self._index_loaded = True

    def _path_for(self, doc_id: str) -> Path:
        self._ensure_index()
        rel = self._index.get(doc_id)
        if rel is None:
            raise DocumentNotFound(doc_id)
        path = self._resolve(rel)
        if not path.exists():
            self._index.pop(doc_id, None)
            raise DocumentNotFound(doc_id)
        return path

    # ── 读取 ──
    def _record_from_path(self, path: Path) -> DocRecord:
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        rel = self._rel(path)
        folder = rel.rsplit("/", 1)[0] if "/" in rel else ""
        doc_id = str(meta.get("doc_id") or path.stem)
        title = str(meta.get("title") or path.stem)
        tags = meta.get("tags") or []
        if not isinstance(tags, list):
            tags = [str(tags)]
        tags = [str(t) for t in tags]
        return DocRecord(
            doc_id=doc_id,
            path=rel,
            folder=folder,
            title=title,
            tags=tags,
            created_at=str(meta.get("created_at") or now_iso()),
            updated_at=str(meta.get("updated_at") or meta.get("created_at") or now_iso()),
            content=body,
            frontmatter=meta,
        )

    def read(self, doc_id: str) -> DocRecord:
        return self._record_from_path(self._path_for(doc_id))

    def exists(self, doc_id: str) -> bool:
        try:
            self._path_for(doc_id)
            return True
        except DocumentNotFound:
            return False

    def list(self, folder: str | None = None, q: str | None = None, tag: str | None = None) -> list[DocRecord]:
        self._ensure_index()
        folder = (folder or "").replace("\\", "/").strip("/")
        q = (q or "").strip().lower()
        tag = (tag or "").strip()
        records: list[DocRecord] = []
        with self._lock:
            items = list(self._index.items())
        for doc_id, rel in items:
            if folder and not (rel == folder or rel.startswith(folder + "/")):
                continue
            try:
                record = self._record_from_path(self._resolve(rel))
            except (OSError, PathTraversalError):
                continue
            if tag and tag not in record.tags:
                continue
            if q:
                haystack = f"{record.title}\n{' '.join(record.tags)}\n{record.content}".lower()
                if q not in haystack:
                    continue
            records.append(record)
        records.sort(key=lambda r: r.updated_at, reverse=True)
        return records

    # ── 写入 ──
    def _unique_path(self, folder: str, filename: str, doc_id: str) -> Path:
        base = self._resolve(f"{folder}/{filename}" if folder else filename)
        base.parent.mkdir(parents=True, exist_ok=True)
        candidate = base
        stem, suffix = base.stem, base.suffix
        counter = 2
        while candidate.exists():
            existing_meta, _ = parse_frontmatter(candidate.read_text(encoding="utf-8"))
            if existing_meta.get("doc_id") == doc_id:
                return candidate
            candidate = base.with_name(f"{stem}_{counter}{suffix}")
            counter += 1
        return candidate

    def create(
        self,
        *,
        doc_id: str,
        title: str,
        folder: str,
        content: str,
        extra_meta: dict[str, Any] | None = None,
        created_at: str | None = None,
    ) -> DocRecord:
        folder = (folder or "").replace("\\", "/").strip("/")
        if ".." in folder.split("/"):
            raise PathTraversalError("path traversal detected")
        created = created_at or now_iso()
        date_prefix = created[:10]
        filename = f"{date_prefix}_{slugify_title(title)}.md"
        meta: dict[str, Any] = {
            "doc_id": doc_id,
            "title": title,
            "created_at": created,
            "updated_at": created,
            "tags": [],
        }
        if extra_meta:
            meta.update(extra_meta)
        with self._lock:
            path = self._unique_path(folder, filename, doc_id)
            path.write_text(dump_frontmatter(meta, content), encoding="utf-8")
            self._index[doc_id] = self._rel(path)
            self._index_loaded = True
        return self._record_from_path(path)

    def update(self, doc_id: str, content: str, title: str | None = None, tags: list[str] | None = None) -> DocRecord:
        with self._lock:
            path = self._path_for(doc_id)
            meta, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
            if title is not None:
                meta["title"] = title
            if tags is not None:
                meta["tags"] = tags
            meta["updated_at"] = now_iso()
            path.write_text(dump_frontmatter(meta, content), encoding="utf-8")
        return self._record_from_path(path)

    def write_full(self, doc_id: str, meta: dict[str, Any], content: str) -> DocRecord:
        """整体覆写（用于快照回滚等），保留 doc_id。"""
        with self._lock:
            path = self._path_for(doc_id)
            meta = dict(meta)
            meta["doc_id"] = doc_id
            meta["updated_at"] = now_iso()
            path.write_text(dump_frontmatter(meta, content), encoding="utf-8")
        return self._record_from_path(path)

    def delete(self, doc_id: str) -> None:
        with self._lock:
            path = self._path_for(doc_id)
            path.unlink()
            self._index.pop(doc_id, None)

    def move(self, doc_id: str, folder: str | None = None, filename: str | None = None) -> DocRecord:
        with self._lock:
            path = self._path_for(doc_id)
            record = self._record_from_path(path)
            target_folder = record.folder if folder is None else folder.replace("\\", "/").strip("/")
            if ".." in target_folder.split("/"):
                raise PathTraversalError("path traversal detected")
            if filename is None:
                target_name = path.name
            else:
                target_name = slugify_title(filename.removesuffix(".md")) + ".md"
            target = self._unique_path(target_folder, target_name, doc_id)
            if target != path:
                path.rename(target)
                self._index[doc_id] = self._rel(target)
        return self._record_from_path(target)

    # ── 文件夹 ──
    def tree(self) -> dict[str, Any]:
        self._ensure_index()
        root_node: dict[str, Any] = {"name": "", "path": "", "doc_count": 0, "children": []}
        nodes: dict[str, dict[str, Any]] = {"": root_node}

        def ensure_folder(rel: str) -> dict[str, Any]:
            if rel in nodes:
                return nodes[rel]
            parent_rel = rel.rsplit("/", 1)[0] if "/" in rel else ""
            parent = ensure_folder(parent_rel)
            node = {"name": rel.rsplit("/", 1)[-1], "path": rel, "doc_count": 0, "children": []}
            parent["children"].append(node)
            nodes[rel] = node
            return node

        with self._lock:
            rels = list(self._index.values())
        for rel in rels:
            folder = rel.rsplit("/", 1)[0] if "/" in rel else ""
            node = ensure_folder(folder)
            node["doc_count"] += 1
        # 包含磁盘上真实存在的空文件夹
        for directory in sorted(self._root.rglob("*")):
            if directory.is_dir():
                ensure_folder(self._rel(directory))

        def sort_children(node: dict[str, Any]) -> None:
            node["children"].sort(key=lambda n: n["name"])
            for child in node["children"]:
                sort_children(child)

        sort_children(root_node)
        return root_node

    def create_folder(self, path: str) -> dict[str, Any]:
        rel = (path or "").replace("\\", "/").strip("/")
        if not rel:
            raise ValueError("folder path required")
        target = self._resolve(rel)
        target.mkdir(parents=True, exist_ok=True)
        return self.tree()

    def rename_folder(self, path: str, new_name: str) -> dict[str, Any]:
        rel = (path or "").replace("\\", "/").strip("/")
        if not rel:
            raise ValueError("cannot rename root")
        new_name = slugify_title(new_name)
        source = self._resolve(rel)
        if not source.is_dir():
            raise DocumentNotFound(rel)
        parent_rel = rel.rsplit("/", 1)[0] if "/" in rel else ""
        new_rel = f"{parent_rel}/{new_name}" if parent_rel else new_name
        target = self._resolve(new_rel)
        if target.exists():
            raise ValueError("target folder already exists")
        with self._lock:
            source.rename(target)
            self._index_loaded = False
        return self.tree()

    def delete_folder(self, path: str, force: bool = False) -> None:
        rel = (path or "").replace("\\", "/").strip("/")
        if not rel:
            raise ValueError("cannot delete root")
        target = self._resolve(rel)
        if not target.is_dir():
            raise DocumentNotFound(rel)
        has_docs = any(target.rglob("*.md"))
        if has_docs and not force:
            raise ValueError("folder not empty; use force=true")
        with self._lock:
            import shutil

            shutil.rmtree(target)
            self._index_loaded = False


_store: MarkdownStore | None = None
_store_lock = threading.Lock()


def get_store() -> MarkdownStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = MarkdownStore()
        elif _store.root.resolve() != settings.output_dir.resolve():
            _store.reconfigure(settings.output_dir)
        return _store