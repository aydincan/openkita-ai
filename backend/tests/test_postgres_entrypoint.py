"""The Compose database entrypoint must refuse placeholder passwords before PostgreSQL starts."""

import os
import subprocess
from pathlib import Path

import pytest

from app.core.config import _PLACEHOLDER_PASSWORDS
from tests.conftest import TEST_PASSWORD

SCRIPT = Path(__file__).resolve().parents[2] / "deployment" / "docker" / "postgres-entrypoint.sh"

REFUSAL = (
    "POSTGRES_PASSWORD is missing or a placeholder (such as 'change-me'). "
    "Set a strong, unique password in .env.\n"
)


def _run(
    password: str | None,
    *args: str,
    path_dir: Path | None = None,
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    if password is None:
        env.pop("POSTGRES_PASSWORD", None)
    else:
        env["POSTGRES_PASSWORD"] = password
    if path_dir is not None:
        env["PATH"] = f"{path_dir}{os.pathsep}{env.get('PATH', '')}"
    if extra_env:
        env.update(extra_env)
    # Fixed repository script; arguments are test literals, not user input.
    return subprocess.run(  # noqa: S603
        ["/bin/sh", str(SCRIPT), *args],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_script_exists() -> None:
    assert SCRIPT.is_file()


@pytest.mark.parametrize(
    "password",
    sorted(password for password in _PLACEHOLDER_PASSWORDS if password)
    + ["Change-Me", "PASSWORD", "change-me ", " change-me", " Change-Me "],
)
def test_placeholder_passwords_are_refused(password: str) -> None:
    result = _run(password, "postgres")
    assert result.returncode == 1
    assert result.stderr == REFUSAL
    assert result.stdout == ""


def test_missing_password_is_refused() -> None:
    result = _run(None, "postgres")
    assert result.returncode == 1
    assert result.stderr == REFUSAL


def test_real_password_reaches_the_official_entrypoint(tmp_path: Path) -> None:
    fake = tmp_path / "docker-entrypoint.sh"
    out = tmp_path / "args"
    fake.write_text('#!/bin/sh\nprintf \'%s\\n\' "$@" > "$OUT"\n')
    fake.chmod(0o755)
    result = _run(TEST_PASSWORD, "postgres", path_dir=tmp_path, extra_env={"OUT": str(out)})
    assert result.returncode == 0, result.stderr
    assert out.read_text() == "postgres\n"
    assert TEST_PASSWORD not in result.stdout
    assert TEST_PASSWORD not in result.stderr
