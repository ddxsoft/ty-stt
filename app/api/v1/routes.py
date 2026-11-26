"""路由汇总 + /health。"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import audio, documents, folders, polish, settings, transcriptions
from app.core.config import settings as app_settings
from app.storage.markdown_store import now_iso

api_router = APIRouter()
api_router.include_router(transcriptions.router)
api_router.include_router(documents.router)
api_router.include_router(folders.router)
api_router.include_router(polish.router)
api_router.include_router(audio.router)
api_router.include_router(settings.settings_router)
api_router.include_router(settings.prompts_router)
api_router.include_router(settings.glossary_router)


@api_router.get("/health", tags=["health"])
async def health():
    return {
        "status": "ok",
        "app": app_settings.app_name,
        "version": app_settings.app_version,
        "timestamp": now_iso(),
        "stt_engine": app_settings.stt_engine,
        "llm_model": app_settings.llm_model,
    }