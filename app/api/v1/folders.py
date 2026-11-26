"""文件夹 API：树获取、新建、重命名、删除。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas import CreateFolderBody, RenameFolderBody
from app.storage.markdown_store import DocumentNotFound, PathTraversalError, get_store

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("")
async def get_folders():
    return get_store().tree()


@router.post("")
async def create_folder(body: CreateFolderBody):
    try:
        return get_store().create_folder(body.path)
    except PathTraversalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("")
async def rename_folder(body: RenameFolderBody):
    try:
        return get_store().rename_folder(body.path, body.new_name)
    except DocumentNotFound as exc:
        raise HTTPException(status_code=404, detail="folder not found") from exc
    except PathTraversalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("", status_code=204)
async def delete_folder(path: str = Query(...), force: bool = Query(False)):
    try:
        get_store().delete_folder(path, force=force)
    except DocumentNotFound as exc:
        raise HTTPException(status_code=404, detail="folder not found") from exc
    except PathTraversalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return None