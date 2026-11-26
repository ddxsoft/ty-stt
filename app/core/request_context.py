from contextvars import ContextVar, Token
from typing import Optional, Tuple


_request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_trace_id: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)


def set_context(request_id: str, trace_id: str) -> Tuple[Token, Token]:
    request_token = _request_id.set(request_id)
    trace_token = _trace_id.set(trace_id)
    return request_token, trace_token


def reset_context(tokens: Tuple[Token, Token]) -> None:
    _request_id.reset(tokens[0])
    _trace_id.reset(tokens[1])


def get_request_id() -> Optional[str]:
    return _request_id.get()


def get_trace_id() -> Optional[str]:
    return _trace_id.get()
