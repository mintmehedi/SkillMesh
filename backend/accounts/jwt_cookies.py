"""HttpOnly JWT cookies for browser clients."""

from django.conf import settings
from django.http import HttpResponseBase
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


def _cookie_secure() -> bool:
    if hasattr(settings, "JWT_COOKIE_SECURE"):
        return bool(settings.JWT_COOKIE_SECURE)
    return not settings.DEBUG


def _cookie_samesite() -> str:
    return getattr(settings, "JWT_COOKIE_SAMESITE", "Lax")


def _cookie_path() -> str:
    return getattr(settings, "JWT_COOKIE_PATH", "/")


def _access_max_age() -> int:
    return int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())


def _refresh_max_age() -> int:
    return int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())


def set_jwt_cookies(response: HttpResponseBase, access: str, refresh: str) -> None:
    common = {
        "httponly": True,
        "secure": _cookie_secure(),
        "samesite": _cookie_samesite(),
        "path": _cookie_path(),
    }
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access,
        max_age=_access_max_age(),
        **common,
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh,
        max_age=_refresh_max_age(),
        **common,
    )


def clear_jwt_cookies(response: HttpResponseBase) -> None:
    # `delete_cookie` only accepts path/domain/samesite (not httponly/secure).
    common = {
        "samesite": _cookie_samesite(),
        "path": _cookie_path(),
    }
    for name in (settings.JWT_ACCESS_COOKIE_NAME, settings.JWT_REFRESH_COOKIE_NAME):
        response.delete_cookie(name, **common)


def tokens_for_user(user) -> tuple[str, str]:
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


def auth_response_with_cookies(user, payload: dict | None = None, *, status: int = 200) -> Response:
    access, refresh = tokens_for_user(user)
    body = dict(payload or {})
    if getattr(settings, "JWT_INCLUDE_TOKENS_IN_RESPONSE_BODY", False):
        body["access"] = access
        body["refresh"] = refresh
    response = Response(body, status=status)
    set_jwt_cookies(response, access, refresh)
    return response


def strip_tokens_from_response_data(response: Response) -> None:
    if isinstance(response.data, dict):
        response.data.pop("access", None)
        response.data.pop("refresh", None)
