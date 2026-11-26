"""AI 润色 API（POST + SSE）：全文重润色、划词局部改写、自动标题摘要。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent.copilot_agent import CopilotAgent
from app.agent.polish_agent import PolishAgent, suggest_title
from app.agent.prompts import load_glossary
from app.api.sse import format_event, sse_response
from app.schemas import PolishDocumentBody, PolishSelectionBody, PolishTitleBody
from app.storage.markdown_store import DocumentNotFound, get_store
from app.storage.sidecar_store import get_sidecar

router = APIRouter(prefix="/polish", tags=["polish"])


@router.post("/document")
async def polish_document(body: PolishDocumentBody):
    try:
        record = get_store().read(body.doc_id)
    except DocumentNotFound as exc:
        raise HTTPException(status_code=404, detail="document not found") from exc

    if body.source == "transcript":
        transcript = get_sidecar().load_transcript(body.doc_id) or {}
        source_text = transcript.get("text") or record.content
    else:
        source_text = record.content

    glossary = load_glossary()
    agent = PolishAgent()

    async def event_gen():
        parts: list[str] = []
        try:
            async for delta in agent.polish_stream(source_text, body.preset, glossary=glossary):
                parts.append(delta)
                yield format_event("delta", {"text": delta})
            yield format_event("done", {"content": "".join(parts).strip()})
        except Exception as exc:
            yield format_event("error", {"message": str(exc)})

    return sse_response(event_gen())


@router.post("/selection")
async def polish_selection(body: PolishSelectionBody):
    raw_transcript = None
    if body.action == "verify" and body.doc_id:
        transcript = get_sidecar().load_transcript(body.doc_id) or {}
        raw_transcript = transcript.get("text") or None

    glossary = load_glossary()
    agent = CopilotAgent()

    async def event_gen():
        parts: list[str] = []
        try:
            async for delta in agent.rewrite_stream(
                body.selection,
                action=body.action,
                instruction=body.instruction,
                before=body.before,
                after=body.after,
                raw_transcript=raw_transcript,
                glossary=glossary,
            ):
                parts.append(delta)
                yield format_event("delta", {"text": delta})
            yield format_event("done", {"content": "".join(parts).strip()})
        except Exception as exc:
            yield format_event("error", {"message": str(exc)})

    return sse_response(event_gen())


@router.post("/title")
async def polish_title(body: PolishTitleBody):
    return await suggest_title(body.content)