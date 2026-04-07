from django.urls import path

from .views import (
    CompanyProfileUpsertView,
    EmployerJobDetailView,
    EmployerJobListCreateView,
    JobListView,
    JobSearchView,
)


urlpatterns = [
    path("company/profile", CompanyProfileUpsertView.as_view(), name="company-profile"),
    path("jobs", EmployerJobListCreateView.as_view(), name="employer-jobs"),
    path("jobs/<int:pk>", EmployerJobDetailView.as_view(), name="employer-job-detail"),
    path("all", JobListView.as_view(), name="jobs-all"),
    path("search", JobSearchView.as_view(), name="jobs-search"),
]
