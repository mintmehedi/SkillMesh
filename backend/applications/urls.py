from django.urls import path

from .views import ApplicationListCreateView

urlpatterns = [
    path("", ApplicationListCreateView.as_view(), name="applications"),
]
