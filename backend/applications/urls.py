from django.urls import path

from .views import ApplicationListCreateView, ApplicationWithdrawView

urlpatterns = [
    path("", ApplicationListCreateView.as_view(), name="applications"),
    path("<int:pk>/withdraw", ApplicationWithdrawView.as_view(), name="application-withdraw"),
]
