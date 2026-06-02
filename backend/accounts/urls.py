from django.urls import path
from .jwt_views import CookieTokenBlacklistView, CookieTokenRefreshView

from .views import (
    AuPostcodeAutocompleteView,
    CityAutocompleteView,
    CandidateMembershipCancelView,
    CandidateMembershipObtainView,
    CandidateMembershipRenewView,
    CandidateMembershipView,
    CountryAutocompleteView,
    EmailLoginView,
    MeView,
    PlaceSearchAutocompleteView,
    RegisterCandidateView,
    RegisterView,
    StateRegionAutocompleteView,
    UsernameAvailabilityView,
)


urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("register/candidate", RegisterCandidateView.as_view(), name="register-candidate"),
    path("login", EmailLoginView.as_view(), name="login"),
    path("refresh", CookieTokenRefreshView.as_view(), name="refresh"),
    path("logout", CookieTokenBlacklistView.as_view(), name="logout"),
    path("me", MeView.as_view(), name="me"),
    path("meta/countries", CountryAutocompleteView.as_view(), name="meta-countries"),
    path("meta/states", StateRegionAutocompleteView.as_view(), name="meta-states"),
    path("meta/cities", CityAutocompleteView.as_view(), name="meta-cities"),
    path("meta/places", PlaceSearchAutocompleteView.as_view(), name="meta-places"),
    path("meta/au-postcodes", AuPostcodeAutocompleteView.as_view(), name="meta-au-postcodes"),
    path("membership", CandidateMembershipView.as_view(), name="candidate-membership"),
    path("membership/obtain", CandidateMembershipObtainView.as_view(), name="candidate-membership-obtain"),
    path("membership/cancel", CandidateMembershipCancelView.as_view(), name="candidate-membership-cancel"),
    path("membership/renew", CandidateMembershipRenewView.as_view(), name="candidate-membership-renew"),
    path(
        "meta/username-availability",
        UsernameAvailabilityView.as_view(),
        name="meta-username-availability",
    ),
]
