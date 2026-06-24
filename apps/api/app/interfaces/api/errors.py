from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.domain.exceptions import DomainError
from app.interfaces.api.schemas import ApiError


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=exc.status_code,
            content=ApiError(code=exc.code, message=exc.message).model_dump(),
        )
