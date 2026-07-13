"""Structured logging setup.

We use `structlog` because unstructured `print()` / `logging.info()`
strings are unusable at audit / observability time. Every log entry we
emit is a JSON object with a timestamp, level, message, and arbitrary
key/value context — machine-readable and human-scannable.

Call `configure_logging()` once at app startup.
"""

from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(env: str) -> None:
    """Configure structlog for the given environment.

    In `local`/`development` we render pretty console output so a human
    can read the logs. In `staging`/`production` we emit JSON so log
    aggregators can index every field.
    """
    # Route stdlib logging through the same pipeline so libraries that
    # use `logging.getLogger(...)` also emit structured records.
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    is_dev = env in {"local", "development"}

    processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if is_dev:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a bound logger. Use module `__name__` as the name."""
    return structlog.get_logger(name)  # type: ignore[return-value]
