from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import EmailLoginView, MeView, RegisterCandidateView, RegisterView


urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("register/candidate", RegisterCandidateView.as_view(), name="register-candidate"),
    path("login", EmailLoginView.as_view(), name="login"),
    path("refresh", TokenRefreshView.as_view(), name="refresh"),
    path("me", MeView.as_view(), name="me"),
]
