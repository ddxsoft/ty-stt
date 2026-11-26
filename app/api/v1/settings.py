"""配置管理 API：系统设置、LLM 连通测试、Prompt 模板、术语词典。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent import prompts
from app.core.config import settings
from app.llm.client import get_llm_client
from app.schemas import (
    Glossary,
    LlmSettings,
    PresetInput,
    SettingsResponse,
    SettingsUpdate,
    StorageSettings,
    SttSettings,
    TestLlmResult,
)
from app.storage.markdown_store import get_store

settings_router = APIRouter(prefix="/settings", tags=["settings"])
prompts_router = APIRouter(prefix="/prompts", tags=["prompts"])
glossary_router = APIRouter(prefix="/glossary", tags=["glossary"])


def _settings_response() -> SettingsResponse:
    return SettingsResponse(
        llm=LlmSettings(
            base_url=settings.llm_base_url,
            api_key_set=bool(settings.llm_api_key),
            model=settings.llm_model,
            temperature=settings.llm_temperature,
        ),
        stt=SttSettings(
            engine=settings.stt_engine if settings.stt_engine in ("funasr", "mock") else "funasr",
            device=settings.stt_device if settings.stt_device in ("cpu", "cuda") else "cpu",
            language=settings.stt_language,
            vad=settings.stt_vad,
        ),
        storage=StorageSettings(output_dir=str(settings.output_dir)),
        default_preset=settings.default_preset,
    )


@settings_router.get("")
async def get_settings() -> SettingsResponse:
    return _settings_response()


@settings_router.put("")
async def update_settings(body: SettingsUpdate) -> SettingsResponse:
    changes: dict = {}
    if body.llm is not None:
        if body.llm.base_url is not None:
            changes["llm_base_url"] = body.llm.base_url
        if body.llm.api_key is not None:
            changes["llm_api_key"] = body.llm.api_key
        if body.llm.model is not None:
            changes["llm_model"] = body.llm.model
        if body.llm.temperature is not None:
            changes["llm_temperature"] = body.llm.temperature
    if body.stt is not None:
        if body.stt.engine is not None:
            changes["stt_engine"] = body.stt.engine
        if body.stt.device is not None:
            changes["stt_device"] = body.stt.device
        if body.stt.language is not None:
            changes["stt_language"] = body.stt.language
        if body.stt.vad is not None:
            changes["stt_vad"] = body.stt.vad
    if body.storage is not None and body.storage.output_dir is not None:
        changes["output_dir"] = body.storage.output_dir
    if body.default_preset is not None:
        changes["default_preset"] = body.default_preset

    settings.update_runtime(changes)
    if "output_dir" in changes:
        get_store().reconfigure(settings.output_dir)
    return _settings_response()


@settings_router.post("/test-llm")
async def test_llm() -> TestLlmResult:
    client = get_llm_client()
    try:
        models = await client.list_models()
        return TestLlmResult(ok=True, message="连接成功", models=models)
    except Exception as exc:
        return TestLlmResult(ok=False, message=f"连接失败：{exc}", models=[])


@prompts_router.get("")
async def list_prompts():
    return prompts.list_presets()


@prompts_router.post("")
async def create_prompt(body: PresetInput):
    return prompts.create_preset(body.name, body.description, body.system_prompt)


@prompts_router.put("/{preset_id}")
async def update_prompt(preset_id: str, body: PresetInput):
    try:
        return prompts.update_preset(preset_id, body.name, body.description, body.system_prompt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="preset not found") from exc


@prompts_router.delete("/{preset_id}", status_code=204)
async def delete_prompt(preset_id: str):
    try:
        prompts.delete_preset(preset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="preset not found") from exc
    return None


@glossary_router.get("")
async def get_glossary():
    return prompts.load_glossary()


@glossary_router.put("")
async def update_glossary(body: Glossary):
    corrections = [{"wrong": c.wrong, "right": c.right} for c in body.corrections]
    return prompts.save_glossary(body.hotwords, corrections)