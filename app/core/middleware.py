"""请求上下文中间件（纯 ASGI 实现，不缓冲响应体，兼容 SSE 流式）。"""

from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.request_context import reset_context, set_context


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_headers = {k.decode("latin-1"): v.decode("latin-1") for k, v in scope.get("headers", [])}
        request_id = raw_headers.get("x-request-id") or uuid4().hex
        trace_id = raw_headers.get("x-trace-id") or uuid4().hex
        tokens = set_context(request_id, trace_id)

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Request-Id"] = request_id
                headers["X-Trace-Id"] = trace_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            reset_context(tokens)