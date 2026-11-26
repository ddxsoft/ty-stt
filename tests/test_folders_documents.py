"""文件夹与文档管理 API 测试（含快照、移动、导出、搜索）。"""

from __future__ import annotations

from app.storage.markdown_store import get_store
from app.storage.sidecar_store import get_sidecar


def _seed_doc(doc_id="doc_test", title="测试文稿", folder="笔记", content="# 标题\n\n正文内容"):
    store = get_store()
    return store.create(doc_id=doc_id, title=title, folder=folder, content=content, extra_meta={"tags": ["t1"]})


def test_folders_create_rename_delete(client):
    assert client.post("/api/v1/folders", json={"path": "课程/易经"}).status_code == 200
    tree = client.get("/api/v1/folders").json()
    assert any(c["name"] == "课程" for c in tree["children"])

    rename = client.patch("/api/v1/folders", json={"path": "课程/易经", "new_name": "卦象"})
    assert rename.status_code == 200
    assert client.delete("/api/v1/folders", params={"path": "课程/卦象"}).status_code == 204
    assert client.delete("/api/v1/folders", params={"path": "不存在"}).status_code == 404


def test_folder_delete_non_empty_requires_force(client):
    _seed_doc(folder="满文件夹")
    assert client.delete("/api/v1/folders", params={"path": "满文件夹"}).status_code == 400
    assert client.delete("/api/v1/folders", params={"path": "满文件夹", "force": True}).status_code == 204


def test_document_list_get_detail(client):
    _seed_doc()
    get_sidecar().save_transcript("doc_test", {"text": "原始逐字稿", "segments": [{"id": 0, "start_ms": 0, "end_ms": 1000, "text": "原始"}]})
    listing = client.get("/api/v1/documents").json()
    assert len(listing) == 1
    assert listing[0]["has_transcript"] is True

    detail = client.get("/api/v1/documents/doc_test").json()
    assert detail["content"].startswith("# 标题")
    assert detail["raw_transcript"] == "原始逐字稿"
    assert detail["segments"][0]["text"] == "原始"
    assert "frontmatter" in detail


def test_document_update_creates_snapshot(client):
    _seed_doc()
    put = client.put("/api/v1/documents/doc_test", json={"content": "修改后的正文", "title": "新标题", "tags": ["t2"]})
    assert put.status_code == 200
    assert put.json()["content"] == "修改后的正文"
    snapshots = client.get("/api/v1/documents/doc_test/snapshots").json()
    assert len(snapshots) == 1
    assert snapshots[0]["reason"] == "编辑保存"

    sid = snapshots[0]["snapshot_id"]
    snap_content = client.get(f"/api/v1/documents/doc_test/snapshots/{sid}").json()
    assert snap_content["content"].startswith("# 标题")

    restored = client.post(f"/api/v1/documents/doc_test/snapshots/{sid}/restore")
    assert restored.status_code == 200
    assert restored.json()["content"].startswith("# 标题")


def test_document_move_and_delete(client):
    _seed_doc()
    moved = client.post("/api/v1/documents/doc_test/move", json={"folder": "归档", "filename": "新名字"})
    assert moved.status_code == 200
    assert moved.json()["folder"] == "归档"
    assert client.delete("/api/v1/documents/doc_test").status_code == 204
    assert client.get("/api/v1/documents/doc_test").status_code == 404


def test_document_search(client):
    _seed_doc(doc_id="d1", title="易经", folder="", content="地变卦象解析")
    _seed_doc(doc_id="d2", title="会议", folder="", content="项目进度")
    assert len(client.get("/api/v1/documents", params={"q": "卦象"}).json()) == 1
    assert len(client.get("/api/v1/documents", params={"folder": "归档"}).json()) == 0


def test_document_export(client):
    _seed_doc()
    md = client.get("/api/v1/documents/doc_test/export", params={"format": "md"})
    assert md.status_code == 200
    assert "doc_test" in md.text
    txt = client.get("/api/v1/documents/doc_test/export", params={"format": "txt"})
    assert txt.status_code == 200
    assert "正文内容" in txt.text


def test_document_not_found(client):
    assert client.get("/api/v1/documents/nope").status_code == 404
    body = client.get("/api/v1/documents/nope").json()
    assert "error" in body and "message" in body["error"]