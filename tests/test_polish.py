"""AI 润色 API 测试（mock LLM，POST+SSE）：全文重润色、划词改写、标题摘要。"""

from __future__ import annotations

from app.storage.markdown_store import get_store
from app.storage.sidecar_store import get_sidecar
from tests.conftest import parse_sse


def _seed():
    get_store().create(doc_id="doc_p", title="润色测试", folder="", content="当前正文呃然后就是说")
    get_sidecar().save_transcript("doc_p", {"text": "原始逐字稿呃然后", "segments": []})


def test_polish_document_transcript_source(client):
    _seed()
    resp = client.post("/api/v1/polish/document", json={"doc_id": "doc_p", "preset": "medium", "source": "transcript"})
    assert resp.status_code == 200
    events = parse_sse(resp.text)
    assert any(e == "delta" for e, _ in events)
    done = [d for e, d in events if e == "done"]
    assert done and done[0]["content"] == "原始逐字稿呃然后"
    # 不落盘：正文保持不变
    assert client.get("/api/v1/documents/doc_p").json()["content"] == "当前正文呃然后就是说"


def test_polish_document_current_source(client):
    _seed()
    resp = client.post("/api/v1/polish/document", json={"doc_id": "doc_p", "preset": "light", "source": "current"})
    done = [d for e, d in parse_sse(resp.text) if e == "done"]
    assert done[0]["content"] == "当前正文呃然后就是说"


def test_polish_document_none_preset(client):
    _seed()
    resp = client.post("/api/v1/polish/document", json={"doc_id": "doc_p", "preset": "none", "source": "current"})
    done = [d for e, d in parse_sse(resp.text) if e == "done"]
    assert done[0]["content"] == "当前正文呃然后就是说"


def test_polish_document_not_found(client):
    resp = client.post("/api/v1/polish/document", json={"doc_id": "nope", "preset": "medium", "source": "current"})
    assert resp.status_code == 404


def test_polish_selection(client):
    resp = client.post("/api/v1/polish/selection", json={"selection": "需要润色的句子", "action": "polish"})
    assert resp.status_code == 200
    done = [d for e, d in parse_sse(resp.text) if e == "done"]
    assert done[0]["content"] == "需要润色的句子"


def test_polish_selection_verify_with_transcript(client):
    _seed()
    resp = client.post(
        "/api/v1/polish/selection",
        json={"doc_id": "doc_p", "selection": "机器挂", "action": "verify"},
    )
    assert resp.status_code == 200
    assert any(e == "done" for e, _ in parse_sse(resp.text))


def test_polish_title(client):
    resp = client.post("/api/v1/polish/title", json={"content": "# 易经地变卦象解析\n\n正文"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"]
    assert isinstance(data["tags"], list)