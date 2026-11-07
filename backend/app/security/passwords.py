"""Password hashing (argon2) and the same placeholder rules as database settings."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import is_placeholder_password

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

# Not a login secret. Hashed once so an unknown email takes about as long as a real check.
_TIMING_PAD = "timing-pad-not-used-as-a-login"

_HASHERS: dict[str, PasswordHasher] = {}
_DUMMY: dict[str, str] = {}


def password_is_rejected(password: str) -> bool:
    """Refuse short passwords and the placeholders already rejected for ``POSTGRES_PASSWORD``."""
    if len(password) < MIN_PASSWORD_LENGTH or len(password) > MAX_PASSWORD_LENGTH:
        return True
    return is_placeholder_password(password)


def _hasher(app_env: str) -> PasswordHasher:
    cached = _HASHERS.get(app_env)
    if cached is not None:
        return cached
    # Tests hash many passwords; production keeps argon2's defaults.
    hasher = (
        PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
        if app_env == "test"
        else PasswordHasher()
    )
    _HASHERS[app_env] = hasher
    return hasher


def hash_password(app_env: str, password: str) -> str:
    return _hasher(app_env).hash(password)


def verify_password(app_env: str, password_hash: str, password: str) -> bool:
    try:
        return _hasher(app_env).verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def verify_dummy(app_env: str, password: str) -> None:
    """Spend a hash check when the email is unknown, so the response time stays similar."""
    dummy = _DUMMY.get(app_env)
    if dummy is None:
        dummy = hash_password(app_env, _TIMING_PAD)
        _DUMMY[app_env] = dummy
    verify_password(app_env, dummy, password)
