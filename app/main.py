"""ty-stt FastAPI 入口：生命周期、CORS、中间件、异常处理、路由与静态资源。"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.routes import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestContextMiddleware
from app.storage.markdown_store import get_store
from app.storage.task_manager import get_task_manager

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.log_level)
    settings.ensure_dirs()
    get_store()
    manager = get_task_manager()
    await manager.start()
    logger.info("%s %s started (stt=%s, llm=%s)", settings.app_name, settings.app_version, settings.stt_engine, settings.llm_model)
    try:
        yield
    finally:
        await manager.stop()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id", "X-Trace-Id", "Content-Range", "Accept-Ranges"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api/v1")

    dist = Path(__file__).resolve().parent.parent / "web" / "dist"
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")
    return app


app = create_app()