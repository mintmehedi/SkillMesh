from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AuPostcodeAutocompleteView,
    CountryAutocompleteView,
    EmailLoginView,
    MeView,
    RegisterCandidateView,
    RegisterView,
    UsernameAvailabilityView,
)


urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("register/candidate", RegisterCandidateView.as_view(), name="register-candidate"),
    path("login", EmailLoginView.as_view(), name="login"),
    path("refresh", TokenRefreshView.as_view(), name="refresh"),
    path("me", MeView.as_view(), name="me"),
    path("meta/countries", CountryAutocompleteView.as_view(), name="meta-countries"),
    path("meta/au-postcodes", AuPostcodeAutocompleteView.as_view(), name="meta-au-postcodes"),
    path(
        "meta/username-availability",
        UsernameAvailabilityView.as_view(),
        name="meta-username-availability",
    ),
]
