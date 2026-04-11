from django.contrib.auth import get_user_model
import json
from urllib.parse import quote
from urllib.request import Request, urlopen
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .geo_meta import STATES_BY_COUNTRY
from .serializers import (
    CandidateRegisterSerializer,
    EmailTokenObtainPairSerializer,
    MeSerializer,
    RegisterSerializer,
    username_validation_reason,
)


User = get_user_model()


def _http_json(url):
    req = Request(url, headers={"User-Agent": "SkillMesh/1.0 (csit314 student project)"})
    with urlopen(req, timeout=7) as res:  # nosec B310 (controlled URLs)
        return json.loads(res.read().decode("utf-8"))


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class RegisterCandidateView(generics.GenericAPIView):
    serializer_class = CandidateRegisterSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": MeSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.GenericAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(self.get_serializer(request.user).data)


class EmailLoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class CountryAutocompleteView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip().lower()
        if not q:
            return Response([])
        try:
            rows = _http_json(
                f"https://restcountries.com/v3.1/name/{quote(q)}?fields=name,cca2&limit=20"
            )
            normalized = []
            seen = set()
            for row in rows:
                name = row.get("name", {}).get("common", "").strip()
                code = (row.get("cca2") or "").strip().upper()
                if not name or not code:
                    continue
                key = (name, code)
                if key in seen:
                    continue
                seen.add(key)
                normalized.append({"name": name, "code": code})
            return Response(sorted(normalized, key=lambda x: x["name"])[:20])
        except Exception:
            return Response([])


class StateRegionAutocompleteView(views.APIView):
    """States / provinces for a country (ISO 3166-1 alpha-2). Empty list = type freely."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cc = (request.query_params.get("country_code") or "").strip().upper()
        q = (request.query_params.get("q") or "").strip().lower()
        if not cc:
            return Response([])
        states = list(STATES_BY_COUNTRY.get(cc, []))
        if q:
            states = [s for s in states if q in s.lower()]
        return Response([{"name": s} for s in states[:100]])


class CityAutocompleteView(views.APIView):
    """City/town suggestions via Nominatim, scoped by country (and optional state context)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        country_code = (request.query_params.get("country_code") or "").strip().lower()
        state = (request.query_params.get("state") or "").strip()
        if len(q) < 2 or not country_code:
            return Response([])
        try:
            search_q = f"{q}, {state}" if state else q
            rows = _http_json(
                "https://nominatim.openstreetmap.org/search"
                f"?format=jsonv2&addressdetails=1&limit=22&q={quote(search_q)}"
                f"&countrycodes={quote(country_code)}"
            )
        except Exception:
            return Response([])
        cities = []
        seen = set()
        for row in rows:
            addr = row.get("address", {})
            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
                or addr.get("hamlet")
            )
            if not city:
                continue
            key = city.strip().lower()
            if key in seen:
                continue
            seen.add(key)
            cities.append({"name": city.strip()})
            if len(cities) >= 20:
                break
        return Response(cities)


class AuPostcodeAutocompleteView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip().lower()
        country_code = (request.query_params.get("country_code") or "").strip().lower()
        if not q:
            return Response([])
        try:
            country_part = f"&countrycodes={quote(country_code)}" if country_code else ""
            rows = _http_json(
                "https://nominatim.openstreetmap.org/search"
                f"?format=jsonv2&addressdetails=1&limit=20&q={quote(q)}{country_part}"
            )
            normalized = []
            for row in rows:
                addr = row.get("address", {})
                suburb = (
                    addr.get("suburb")
                    or addr.get("city_district")
                    or addr.get("city")
                    or addr.get("town")
                    or addr.get("village")
                )
                postcode = addr.get("postcode", "")
                state = addr.get("state", "")
                ccode = addr.get("country_code", "").upper()
                if not suburb:
                    continue
                normalized.append(
                    {
                        "postcode": postcode,
                        "suburb": suburb,
                        "state": state,
                        "country_code": ccode,
                    }
                )
            unique = []
            seen = set()
            for r in normalized:
                key = (r["postcode"], r["suburb"], r["state"], r["country_code"])
                if key in seen:
                    continue
                seen.add(key)
                unique.append(r)
            return Response(unique[:20])
        except Exception:
            return Response([])


class UsernameAvailabilityView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        username = (request.query_params.get("username") or "").strip()
        reason = username_validation_reason(username)
        payload = {"username": username, "available": reason is None}
        if reason:
            payload["reason"] = reason
            if reason == "taken":
                existing = User.objects.filter(username__iexact=username).first()
                if existing:
                    payload["existing_role"] = existing.role
        return Response(payload)
