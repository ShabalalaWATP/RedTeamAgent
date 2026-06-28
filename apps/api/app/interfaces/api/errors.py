from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.exceptions import AuthenticationError, DomainError, MfaRequiredError, MfaSetupRequiredError
from app.interfaces.api.schemas import ApiError


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        del request
        coded_auth_errors = (MfaRequiredError, MfaSetupRequiredError)
        if isinstance(exc, AuthenticationError) and not isinstance(exc, coded_auth_errors):
            return JSONResponse(status_code=exc.status_code, content={"message": exc.message})
        return JSONResponse(
            status_code=exc.status_code,
            content=ApiError(code=exc.code, message=exc.message).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        del request, exc
        return JSONResponse(
            status_code=422,
            content=ApiError(code="validation_failed", message="Check the form fields and try again.").model_dump(),
        )
