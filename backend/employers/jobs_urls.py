from django.urls import path

from .views import JobFeedView, JobListView, JobPublicDetailView, JobSearchView

urlpatterns = [
    path("", JobListView.as_view(), name="jobs-all"),
    path("feed", JobFeedView.as_view(), name="jobs-feed"),
    path("search", JobSearchView.as_view(), name="jobs-search"),
    path("<int:pk>/", JobPublicDetailView.as_view(), name="jobs-public-detail"),
]
