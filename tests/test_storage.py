"""存储层单元测试：Frontmatter、文件名净化、路径安全、文档 CRUD、文件夹树。"""

from __future__ import annotations

import pytest

from app.storage.markdown_store import (
    MarkdownStore,
    PathTraversalError,
    dump_frontmatter,
    parse_frontmatter,
    slugify_title,
)


def test_frontmatter_roundtrip():
    meta = {"doc_id": "doc_x", "title": "标题", "tags": ["会议", "复盘"]}
    raw = dump_frontmatter(meta, "# 正文\n\n内容")
    parsed, body = parse_frontmatter(raw)
    assert parsed["doc_id"] == "doc_x"
    assert parsed["title"] == "标题"
    assert parsed["tags"] == ["会议", "复盘"]
    assert body.startswith("# 正文")


def test_parse_without_frontmatter():
    meta, body = parse_frontmatter("# 纯正文\n没有 frontmatter")
    assert meta == {}
    assert body.startswith("# 纯正文")


def test_slugify_strips_illegal():
    assert slugify_title('会议/纪要:2026*?"<>|') == "会议纪要2026"
    assert slugify_title("   ") == "未命名"


def test_create_read_update_delete(tmp_path):
    store = MarkdownStore(tmp_path)
    record = store.create(doc_id="doc_1", title="项目复盘", folder="会议纪要", content="原始内容")
    assert record.path.startswith("会议纪要/")
    assert record.path.endswith(".md")
    assert (tmp_path / record.path).exists()

    fetched = store.read("doc_1")
    assert fetched.content == "原始内容"
    assert fetched.folder == "会议纪要"

    updated = store.update("doc_1", "新内容", title="新标题", tags=["a"])
    assert updated.content == "新内容"
    assert updated.title == "新标题"
    assert updated.tags == ["a"]

    store.delete("doc_1")
    assert not store.exists("doc_1")


def test_path_traversal_rejected(tmp_path):
    store = MarkdownStore(tmp_path)
    with pytest.raises(PathTraversalError):
        store.create(doc_id="doc_evil", title="x", folder="../escape", content="bad")


def test_move_and_unique_filename(tmp_path):
    store = MarkdownStore(tmp_path)
    store.create(doc_id="d1", title="同名", folder="", content="a")
    store.create(doc_id="d2", title="同名", folder="", content="b")
    r1 = store.read("d1")
    r2 = store.read("d2")
    assert r1.path != r2.path
    moved = store.move("d1", folder="归档", filename="改名")
    assert moved.folder == "归档"
    assert "改名" in moved.path
    assert store.read("d1").content == "a"


def test_folder_tree_counts(tmp_path):
    store = MarkdownStore(tmp_path)
    store.create(doc_id="d1", title="a", folder="课程/易经", content="x")
    store.create(doc_id="d2", title="b", folder="课程", content="y")
    store.create_folder("空文件夹")
    tree = store.tree()
    assert tree["path"] == ""
    names = {child["name"] for child in tree["children"]}
    assert "课程" in names
    assert "空文件夹" in names
    course = next(c for c in tree["children"] if c["name"] == "课程")
    assert course["doc_count"] == 1
    assert any(c["name"] == "易经" for c in course["children"])


def test_search_by_query_and_tag(tmp_path):
    store = MarkdownStore(tmp_path)
    store.create(doc_id="d1", title="易经解析", folder="", content="地变卦象", extra_meta={"tags": ["国学"]})
    store.create(doc_id="d2", title="项目会议", folder="", content="进度讨论", extra_meta={"tags": ["工作"]})
    assert len(store.list(q="卦象")) == 1
    assert len(store.list(tag="工作")) == 1
    assert len(store.list()) == 2