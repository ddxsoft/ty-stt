from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import get_request_id, get_trace_id


def _error_payload(code: str, message: str) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": get_request_id(),
            "trace_id": get_trace_id(),
        }
    }


def _error_response(code: str, message: str, status_code: int) -> JSONResponse:
    response = JSONResponse(status_code=status_code, content=_error_payload(code, message))
    if get_request_id():
        response.headers["X-Request-Id"] = get_request_id()
    if get_trace_id():
        response.headers["X-Trace-Id"] = get_trace_id()
    return response


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error_response("HTTP_ERROR", str(exc.detail), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        message = errors[0].get("msg", "invalid request") if errors else "invalid request"
        return _error_response("VALIDATION_ERROR", str(message), 422)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        return _error_response("INTERNAL_ERROR", "internal server error", 500)
