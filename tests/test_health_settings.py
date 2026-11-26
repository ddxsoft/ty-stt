"""健康检查、系统设置、LLM 连通测试、Prompt 模板与术语词典 API 测试。"""

from __future__ import annotations


def test_health(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["stt_engine"] == "mock"
    assert data["llm_model"] == "mock"


def test_settings_get_and_update(client):
    resp = client.get("/api/v1/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stt"]["engine"] == "mock"
    assert "api_key_set" in data["llm"]
    assert "api_key" not in data["llm"]

    put = client.put("/api/v1/settings", json={"llm": {"model": "mock", "temperature": 0.7}, "default_preset": "heavy"})
    assert put.status_code == 200
    assert put.json()["llm"]["temperature"] == 0.7
    assert put.json()["default_preset"] == "heavy"


def test_settings_api_key_write_only(client):
    resp = client.put("/api/v1/settings", json={"llm": {"api_key": "secret-123"}})
    assert resp.status_code == 200
    assert resp.json()["llm"]["api_key_set"] is True
    assert "api_key" not in resp.json()["llm"]


def test_test_llm_mock(client):
    resp = client.post("/api/v1/settings/test-llm")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "mock" in data["models"]


def test_prompts_crud(client):
    listing = client.get("/api/v1/prompts").json()
    builtin_ids = {p["id"] for p in listing if p["builtin"]}
    assert {"none", "light", "medium", "heavy", "structured"} <= builtin_ids

    created = client.post("/api/v1/prompts", json={"name": "自定义", "description": "d", "system_prompt": "sp"})
    assert created.status_code == 200
    pid = created.json()["id"]
    assert created.json()["builtin"] is False

    updated = client.put(f"/api/v1/prompts/{pid}", json={"name": "改名", "description": "d2", "system_prompt": "sp2"})
    assert updated.json()["name"] == "改名"

    assert client.delete(f"/api/v1/prompts/{pid}").status_code == 204
    assert client.delete("/api/v1/prompts/medium").status_code == 400
    assert client.put("/api/v1/prompts/medium", json={"name": "x", "description": "", "system_prompt": "y"}).status_code == 400


def test_glossary_roundtrip(client):
    body = {"hotwords": ["地变", "井卦"], "corrections": [{"wrong": "机器挂", "right": "既济卦"}]}
    put = client.put("/api/v1/glossary", json=body)
    assert put.status_code == 200
    got = client.get("/api/v1/glossary").json()
    assert got["hotwords"] == ["地变", "井卦"]
    assert got["corrections"][0]["right"] == "既济卦"