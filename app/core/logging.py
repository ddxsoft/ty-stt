import logging

from app.core.request_context import get_request_id, get_trace_id


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not getattr(record, "request_id", None):
            record.request_id = get_request_id() or "-"
        if not getattr(record, "trace_id", None):
            record.trace_id = get_trace_id() or "-"
        return True


def _with_request_context(base_factory):
    def factory(*args, **kwargs) -> logging.LogRecord:
        record = base_factory(*args, **kwargs)
        if not getattr(record, "request_id", None):
            record.request_id = get_request_id() or "-"
        if not getattr(record, "trace_id", None):
            record.trace_id = get_trace_id() or "-"
        return record

    return factory


def configure_logging(level: str) -> None:
    logging.setLogRecordFactory(_with_request_context(logging.getLogRecordFactory()))
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [req:%(request_id)s trace:%(trace_id)s] %(name)s: %(message)s",
    )
    logging.getLogger().addFilter(RequestContextFilter())


def get_logger(name: str | None = None) -> logging.Logger:
    """获取带请求上下文的logger"""
    return logging.getLogger(name)

