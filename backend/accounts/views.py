from django.contrib.auth import get_user_model
import json
from urllib.parse import quote
from urllib.request import Request, urlopen
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .geo_meta import AU_SUBURB_POSTCODES, COUNTRIES, STATES_BY_COUNTRY
from .jwt_cookies import auth_response_with_cookies, clear_jwt_cookies, set_jwt_cookies, strip_tokens_from_response_data
from .throttling import AuthAnonThrottle, MetaAutocompleteThrottle
from .membership import get_or_create_company_membership, get_or_create_membership
from .serializers import (
    CandidateMembershipSerializer,
    CompanyMembershipSerializer,
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
    throttle_classes = [AuthAnonThrottle]


class RegisterCandidateView(generics.GenericAPIView):
    serializer_class = CandidateRegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthAnonThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return auth_response_with_cookies(
            user,
            {"user": MeSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.GenericAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(self.get_serializer(request.user).data)

    def delete(self, request):
        request.user.delete()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_jwt_cookies(response)
        return response


class EmailLoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = [AuthAnonThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            access = response.data.get("access")
            refresh = response.data.get("refresh")
            if access and refresh:
                set_jwt_cookies(response, access, refresh)
                strip_tokens_from_response_data(response)
        return response


class CandidateMembershipView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.CANDIDATE:
            return Response({"detail": "Candidate account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_membership(request.user)
        return Response(CandidateMembershipSerializer(membership).data)


class CandidateMembershipObtainView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.CANDIDATE:
            return Response({"detail": "Candidate account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_membership(request.user)
        membership.activate_premium()
        return Response(CandidateMembershipSerializer(membership).data, status=status.HTTP_200_OK)


class CandidateMembershipCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.CANDIDATE:
            return Response({"detail": "Candidate account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_membership(request.user)
        membership.cancel()
        return Response(CandidateMembershipSerializer(membership).data, status=status.HTTP_200_OK)


class CandidateMembershipRenewView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.CANDIDATE:
            return Response({"detail": "Candidate account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_membership(request.user)
        membership.activate_premium()
        return Response(CandidateMembershipSerializer(membership).data, status=status.HTTP_200_OK)


class CompanyMembershipView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.EMPLOYER:
            return Response({"detail": "Employer account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_company_membership(request.user)
        return Response(CompanyMembershipSerializer(membership).data)


class CompanyMembershipObtainView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.EMPLOYER:
            return Response({"detail": "Employer account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_company_membership(request.user)
        membership.activate_premium()
        return Response(CompanyMembershipSerializer(membership).data, status=status.HTTP_200_OK)


class CompanyMembershipCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.EMPLOYER:
            return Response({"detail": "Employer account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_company_membership(request.user)
        membership.cancel()
        return Response(CompanyMembershipSerializer(membership).data, status=status.HTTP_200_OK)


class CompanyMembershipRenewView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Role.EMPLOYER:
            return Response({"detail": "Employer account required."}, status=status.HTTP_403_FORBIDDEN)
        membership = get_or_create_company_membership(request.user)
        membership.activate_premium()
        return Response(CompanyMembershipSerializer(membership).data, status=status.HTTP_200_OK)


class CountryAutocompleteView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [MetaAutocompleteThrottle]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip().lower()
        if not q:
            return Response([])
        local_matches = [
            row
            for row in COUNTRIES
            if q in row["name"].lower() or q in row["code"].lower()
        ]
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
            merged = {row["code"]: row for row in local_matches}
            for row in normalized:
                merged[row["code"]] = row
            return Response(sorted(merged.values(), key=lambda x: x["name"])[:20])
        except Exception:
            return Response(sorted(local_matches, key=lambda x: x["name"])[:20])


class StateRegionAutocompleteView(views.APIView):
    """States / provinces for a country (ISO 3166-1 alpha-2). Empty list = type freely."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [MetaAutocompleteThrottle]

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
    throttle_classes = [MetaAutocompleteThrottle]

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


class PlaceSearchAutocompleteView(views.APIView):
    """
    Global place suggestions (OpenStreetMap Nominatim) for job search and similar UIs.
    Clients should debounce requests (Nominatim usage policy).
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [MetaAutocompleteThrottle]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 3:
            return Response([])
        try:
            rows = _http_json(
                "https://nominatim.openstreetmap.org/search"
                f"?format=jsonv2&addressdetails=1&limit=10&q={quote(q)}"
            )
        except Exception:
            return Response([])
        if not isinstance(rows, list):
            return Response([])
        out = []
        seen_labels = set()
        for row in rows:
            addr = row.get("address") or {}
            terms = []
            term_seen = set()

            def add_term(s):
                s = (s or "").strip()
                if len(s) < 2:
                    return
                low = s.lower()
                if low in term_seen:
                    return
                term_seen.add(low)
                terms.append(low)

            for key in (
                "suburb",
                "city",
                "town",
                "village",
                "municipality",
                "hamlet",
                "state",
                "region",
            ):
                add_term(addr.get(key))

            label_parts = []
            for key in ("suburb", "city", "town", "village", "municipality", "hamlet"):
                val = (addr.get(key) or "").strip()
                if val:
                    label_parts.append(val)
                    break
            state = (addr.get("state") or addr.get("region") or "").strip()
            if state:
                label_parts.append(state)
            label = ", ".join(label_parts).strip()
            if not label:
                display = (row.get("display_name") or "").strip()
                if display:
                    chunks = [c.strip() for c in display.split(",") if c.strip()]
                    label = ", ".join(chunks[:2]) if chunks else display
            if not label or label.lower() in seen_labels:
                continue
            seen_labels.add(label.lower())
            lat = row.get("lat")
            lon = row.get("lon")
            try:
                lat_f = float(lat) if lat is not None else None
                lon_f = float(lon) if lon is not None else None
            except (TypeError, ValueError):
                lat_f = lon_f = None
            out.append({"label": label, "lat": lat_f, "lon": lon_f, "terms": terms})
            if len(out) >= 8:
                break
        return Response(out)


class AuPostcodeAutocompleteView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [MetaAutocompleteThrottle]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip().lower()
        country_code = (request.query_params.get("country_code") or "").strip().lower()
        if not q:
            return Response([])
        local_matches = []
        for row in AU_SUBURB_POSTCODES:
            if country_code and country_code != row["country_code"].lower():
                continue
            haystack = " ".join(
                [
                    row["suburb"].lower(),
                    row["postcode"].lower(),
                    row["state"].lower(),
                    row["country_code"].lower(),
                ]
            )
            if q in haystack:
                local_matches.append(row)
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
            merged = local_matches + normalized
            for r in merged:
                key = (r["postcode"], r["suburb"], r["state"], r["country_code"])
                if key in seen:
                    continue
                seen.add(key)
                unique.append(r)
            return Response(unique[:20])
        except Exception:
            return Response(local_matches[:20])


class UsernameAvailabilityView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [MetaAutocompleteThrottle]

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
