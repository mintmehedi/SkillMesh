from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from .jwt_cookies import clear_jwt_cookies, set_jwt_cookies, strip_tokens_from_response_data


class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request: Request, *args, **kwargs) -> Response:
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if not data.get("refresh"):
            cookie_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
            if cookie_refresh:
                data["refresh"] = cookie_refresh

        serializer = TokenRefreshSerializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise exc

        access = serializer.validated_data["access"]
        refresh = serializer.validated_data.get("refresh", data.get("refresh"))
        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        if refresh:
            set_jwt_cookies(response, access, refresh)
        strip_tokens_from_response_data(response)
        return response


class CookieTokenBlacklistView(TokenBlacklistView):
    def post(self, request: Request, *args, **kwargs) -> Response:
        from rest_framework_simplejwt.serializers import TokenBlacklistSerializer

        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if not data.get("refresh"):
            cookie_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
            if cookie_refresh:
                data["refresh"] = cookie_refresh

        serializer = TokenBlacklistSerializer(data=data)
        # `TokenBlacklistSerializer.validate()` blacklists the refresh token
        # during `is_valid()`; there is no `create()`/`save()` to call.
        serializer.is_valid(raise_exception=True)
        response = Response(status=status.HTTP_200_OK)
        clear_jwt_cookies(response)
        return response
