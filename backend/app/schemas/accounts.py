"""Account, setup and facility payloads. Responses never include a password hash."""

import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.security.passwords import password_is_rejected

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 320 or _EMAIL.fullmatch(email) is None:
        raise ValueError("invalid_email")
    return email


def _password(value: str) -> str:
    if password_is_rejected(value):
        raise ValueError("weak_password")
    return value


def _display_name(value: str) -> str:
    name = value.strip()
    if not name or len(name) > 100:
        raise ValueError("invalid_display_name")
    return name


class SetupRequest(BaseModel):
    facility_name: str = Field(min_length=1, max_length=200)
    email: str
    display_name: str
    password: str

    @field_validator("facility_name")
    @classmethod
    def _facility(cls, value: str) -> str:
        name = value.strip()
        if not name or len(name) > 200:
            raise ValueError("invalid_facility_name")
        return name

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _email(value)

    @field_validator("display_name")
    @classmethod
    def _check_name(cls, value: str) -> str:
        return _display_name(value)

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return _password(value)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _email(value)


class UserCreateRequest(BaseModel):
    email: str
    display_name: str
    password: str

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _email(value)

    @field_validator("display_name")
    @classmethod
    def _check_name(cls, value: str) -> str:
        return _display_name(value)

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return _password(value)


class FacilityUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        name = value.strip()
        if not name or len(name) > 200:
            raise ValueError("invalid_facility_name")
        return name


class UserResponse(BaseModel):
    id: UUID
    facility_id: UUID
    email: str
    display_name: str
    role: str
    is_active: bool


class FacilityRegionUpdate(BaseModel):
    region_code: str | None

    @field_validator("region_code")
    @classmethod
    def _code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        code = value.strip()
        if not code or len(code) > 16:
            raise ValueError("invalid_region")
        return code


class FacilityResponse(BaseModel):
    id: UUID
    name: str
    exposure_region_code: str | None = None
    exposure_region_label: str | None = None


class SetupStatusResponse(BaseModel):
    needs_setup: bool
