"""Map use-case errors to short HTTP details. No stack traces, no document text."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.services.errors import AppError

# Field validators raise ValueError with one of these codes. The response uses the code
# and never echoes the submitted value.
_FIELD_CODES = (
    "weak_password",
    "invalid_email",
    "invalid_display_name",
    "invalid_facility_name",
    "invalid_facts",
    "invalid_draft",
    "invalid_region",
)


def http_error(exc: AppError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.code)


def validation_detail(exc: RequestValidationError) -> str:
    for error in exc.errors():
        message = str(error.get("msg", ""))
        for code in _FIELD_CODES:
            if code in message:
                return code
    return "validation_error"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": validation_detail(exc)})
