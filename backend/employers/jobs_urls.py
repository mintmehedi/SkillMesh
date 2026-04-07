from django.urls import path

from .views import JobListView, JobSearchView

urlpatterns = [
    path("", JobListView.as_view(), name="jobs-all"),
    path("search", JobSearchView.as_view(), name="jobs-search"),
]
