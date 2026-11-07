import asyncio
from typing import Any, cast
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import DeploymentState, Draft, Facility, User
from app.security.passwords import hash_password
from app.services import auth as auth_service

GOOD_PASSWORD = "Beispiel-Passwort-12"
EDUCATOR_PASSWORD = "Fachkraft-Beispiel-12"


def _setup_body(**overrides: str) -> dict[str, str]:
    body = {
        "facility_name": "Kita Sonnenblume",
        "email": "leitung@kita-sonnenblume.example",
        "display_name": "Frau Beispiel",
        "password": GOOD_PASSWORD,
    }
    body.update(overrides)
    return body


async def _setup(client: AsyncClient) -> dict[str, Any]:
    response = await client.post("/setup", json=_setup_body())
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


async def test_setup_runs_once_and_refuses_weak_passwords(api: Any) -> None:
    client, _factory, _app = api
    status = await client.get("/setup/status")
    assert status.json() == {"needs_setup": True}

    for password in ("change-me", "password", "short", "openkita"):
        rejected = await client.post("/setup", json=_setup_body(password=password))
        assert rejected.status_code == 422
        assert rejected.json()["detail"] == "weak_password"

    created_response = await client.post("/setup", json=_setup_body())
    assert created_response.status_code == 201, created_response.text
    created = created_response.json()
    assert created["role"] == "administrator"
    assert created["display_name"] == "Frau Beispiel"
    raw_cookie = created_response.headers["set-cookie"].lower()
    assert "httponly" in raw_cookie
    assert "samesite=lax" in raw_cookie
    assert GOOD_PASSWORD not in raw_cookie
    assert (await client.get("/auth/me")).status_code == 200

    closed = await client.get("/setup/status")
    assert closed.json() == {"needs_setup": False}
    again = await client.post("/setup", json=_setup_body(email="andere@kita-sonnenblume.example"))
    assert again.status_code == 409
    assert again.json()["detail"] == "setup_closed"


async def test_login_failure_is_the_same_for_unknown_and_wrong_password(api: Any) -> None:
    client, _factory, _app = api
    await _setup(client)
    await client.post("/auth/logout")
    unknown = await client.post(
        "/auth/login",
        json={"email": "niemand@kita-sonnenblume.example", "password": GOOD_PASSWORD},
    )
    wrong = await client.post(
        "/auth/login",
        json={"email": "leitung@kita-sonnenblume.example", "password": "falsches-passwort-12"},
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json() == {"detail": "invalid_credentials"}
    assert (await client.get("/auth/me")).status_code == 401


async def test_educator_cannot_manage_users_or_facility_and_inactive_cannot_login(
    api: Any,
) -> None:
    client, _factory, _app = api
    admin = await _setup(client)
    created = await client.post(
        "/users",
        json={
            "email": "fachkraft@kita-sonnenblume.example",
            "display_name": "Herr Muster",
            "password": EDUCATOR_PASSWORD,
        },
    )
    assert created.status_code == 201, created.text
    educator_id = created.json()["id"]
    duplicate = await client.post(
        "/users",
        json={
            "email": "fachkraft@kita-sonnenblume.example",
            "display_name": "Herr Muster",
            "password": EDUCATOR_PASSWORD,
        },
    )
    assert duplicate.status_code == 409

    await client.post("/auth/logout")
    educator_login = await client.post(
        "/auth/login",
        json={"email": "fachkraft@kita-sonnenblume.example", "password": EDUCATOR_PASSWORD},
    )
    assert educator_login.status_code == 200
    assert educator_login.json()["role"] == "educator"
    assert (await client.get("/users")).status_code == 403
    renamed = await client.patch("/facility", json={"name": "Kita Geaendert"})
    assert renamed.status_code == 403
    assert renamed.json()["detail"] == "forbidden"
    seen = await client.get("/facility")
    assert seen.status_code == 200
    assert seen.json()["name"] == "Kita Sonnenblume"
    assert seen.json()["id"] == admin["facility_id"]

    await client.post("/auth/logout")
    admin_login = await client.post(
        "/auth/login",
        json={"email": "leitung@kita-sonnenblume.example", "password": GOOD_PASSWORD},
    )
    assert admin_login.status_code == 200
    updated = await client.patch("/facility", json={"name": "Kita Sonnenblume Nord"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Kita Sonnenblume Nord"
    deactivated = await client.post(f"/users/{educator_id}/deactivate")
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    self_deactivate = await client.post(f"/users/{admin['id']}/deactivate")
    assert self_deactivate.status_code == 403

    await client.post("/auth/logout")
    blocked = await client.post(
        "/auth/login",
        json={"email": "fachkraft@kita-sonnenblume.example", "password": EDUCATOR_PASSWORD},
    )
    assert blocked.status_code == 401
    assert blocked.json()["detail"] == "invalid_credentials"


async def test_rows_are_scoped_to_the_callers_facility(api: Any) -> None:
    client, factory, _app = api
    await _setup(client)
    other_id = await _other_facility_draft(factory)
    listing = await client.get("/drafts")
    assert listing.status_code == 200
    assert all(row["id"] != str(other_id) for row in listing.json())
    missing = await client.get(f"/drafts/{other_id}")
    assert missing.status_code == 404
    users = await client.get("/users")
    assert users.status_code == 200
    assert all(row["email"] != "leitung@kita-mondschein.example" for row in users.json())

    await client.post("/auth/logout")
    other_login = await client.post(
        "/auth/login",
        json={"email": "leitung@kita-mondschein.example", "password": GOOD_PASSWORD},
    )
    assert other_login.status_code == 200
    other_drafts = await client.get("/drafts")
    assert [row["id"] for row in other_drafts.json()] == [str(other_id)]
    assert other_drafts.json()[0]["subject"] == "Hinweis Familie Beispiel"
    assert (await client.get("/facility")).json()["name"] == "Kita Mondschein"


async def _other_facility_draft(factory: async_sessionmaker[AsyncSession]) -> UUID:
    async with factory() as session:
        facility = Facility(name="Kita Mondschein")
        session.add(facility)
        await session.flush()
        user = User(
            facility_id=facility.id,
            email="leitung@kita-mondschein.example",
            password_hash=hash_password("test", GOOD_PASSWORD),
            display_name="Herr Muster",
            role="administrator",
            is_active=True,
        )
        session.add(user)
        await session.flush()
        draft = Draft(
            facility_id=facility.id,
            author_id=user.id,
            skill_name="parent-communication",
            skill_version="0.1.0",
            subject="Hinweis Familie Beispiel",
            body="Liebe Familie Beispiel, dies ist ein Entwurf.\n",
            fields={
                "message_type": "information",
                "tone": "neutral",
                "warnings": [],
                "missing_information": [],
                "key_facts": [],
            },
            language="de",
            status="draft",
            ai_generated=True,
        )
        session.add(draft)
        await session.commit()
        stored = await session.scalar(select(Draft).where(Draft.facility_id == facility.id))
        assert stored is not None
        return stored.id


async def test_overlapping_setup_uses_the_deployment_state_lock(
    api: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Overlapping setups must take the deployment_state row lock.

    The migration inserts that row before anyone calls setup. This test does the
    same, then starts two setups together. SQLite drops FOR UPDATE, so this does
    not prove the second transaction waits. It proves both attempts run the
    locking SELECT, whose FOR UPDATE clause PostgreSQL keeps.
    """
    calls: list[Select[DeploymentState]] = []
    real = auth_service.deployment_state_lock

    def wrapped() -> Select[DeploymentState]:
        statement = real()
        calls.append(statement)
        return statement

    monkeypatch.setattr(auth_service, "deployment_state_lock", wrapped)
    client, factory, _app = api
    async with factory() as session:
        session.add(DeploymentState(id=1, setup_completed=False))
        await session.commit()

    async def post(email: str) -> tuple[int, str]:
        response = await client.post("/setup", json=_setup_body(email=email))
        return response.status_code, response.text

    first, second = await asyncio.gather(
        post("leitung@kita-sonnenblume.example"),
        post("zweite@kita-sonnenblume.example"),
    )
    assert len(calls) >= 2
    assert calls[0]._for_update_arg is not None
    assert [str(clause) for clause in calls[0].get_final_froms()] == ["deployment_state"]
    assert first[0] in (201, 409), first[1]
    assert second[0] in (201, 409), second[1]
    assert 201 in (first[0], second[0])
