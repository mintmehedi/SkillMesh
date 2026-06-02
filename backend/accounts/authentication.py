from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class JWTCookieAuthentication(JWTAuthentication):
    """Prefer HttpOnly access cookie; fall back to Authorization header (tests, API clients)."""

    def authenticate(self, request):
        raw = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if raw:
            try:
                validated = self.get_validated_token(raw)
            except InvalidToken:
                return None
            return self.get_user(validated), validated
        return super().authenticate(request)
