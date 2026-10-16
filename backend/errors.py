"""Application errors and the exception handlers producing the unified error body.

Every response with a status >= 400 has the shape::

    {"error": {"code": <code>, "message": <sentence>, "details": [...]}}

with ``code`` from the fixed set ``validation_error`` (422), ``not_found`` (404),
``conflict`` (409) and ``internal_error`` (500, and every unmapped status).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger(__name__)

VALIDATION_ERROR = "validation_error"
NOT_FOUND = "not_found"
CONFLICT = "conflict"
INTERNAL_ERROR = "internal_error"

_STATUS_TO_CODE = {404: NOT_FOUND, 409: CONFLICT, 422: VALIDATION_ERROR}


def error_body(
    code: str, message: str, details: list[Any] | None = None
) -> dict[str, dict[str, Any]]:
    """Build the unified error body."""
    return {"error": {"code": code, "message": message, "details": details or []}}


class AppError(Exception):
    """Base class for application errors mapped to the unified error body."""

    status_code: int = 500
    code: str = INTERNAL_ERROR

    def __init__(self, message: str, details: list[Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or []


class NotFoundError(AppError):
    status_code = 404
    code = NOT_FOUND


class ConflictError(AppError):
    status_code = 409
    code = CONFLICT


class NotImplementedStubError(AppError):
    """Raised by routes whose behaviour a later ticket implements."""

    status_code = 501
    code = INTERNAL_ERROR


def _app_error_response(exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.details),
    )


class InternalErrorMiddleware(BaseHTTPMiddleware):
    """Turn any unhandled exception into the contract's 500 body.

    Added INSIDE the CORS middleware: a 5xx produced by the outer
    ``ServerErrorMiddleware`` would reach the browser without CORS headers and
    look like a network error instead of a server error.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)
        except Exception:
            logger.exception("unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content=error_body(
                    INTERNAL_ERROR, "Ein unerwarteter interner Fehler ist aufgetreten."
                ),
            )


def register_exception_handlers(app: FastAPI) -> None:
    """Register every handler so no response escapes the unified error body."""

    @app.exception_handler(AppError)
    async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return _app_error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=error_body(
                VALIDATION_ERROR,
                "Die übermittelten Daten sind ungültig.",
                jsonable_encoder(exc.errors()),
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = _STATUS_TO_CODE.get(exc.status_code, INTERNAL_ERROR)
        message = exc.detail if isinstance(exc.detail, str) else "Die Anfrage ist fehlgeschlagen."
        return JSONResponse(status_code=exc.status_code, content=error_body(code, message))

    @app.exception_handler(Exception)
    async def _handle_unexpected(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content=error_body(INTERNAL_ERROR, "Ein unerwarteter interner Fehler ist aufgetreten."),
        )
