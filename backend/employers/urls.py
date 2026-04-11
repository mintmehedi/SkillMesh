from django.urls import path

from .team_views import EmployerTeamInviteListCreateView, EmployerTeamInvitePreviewView
from .views import (
    CompanyProfileUpsertView,
    EmployerJobDetailView,
    EmployerJobListCreateView,
    JobListView,
    JobSearchView,
)


urlpatterns = [
    path("company/profile", CompanyProfileUpsertView.as_view(), name="company-profile"),
    path("team/invite/<uuid:token>", EmployerTeamInvitePreviewView.as_view(), name="employer-team-invite-preview"),
    path("team/invites", EmployerTeamInviteListCreateView.as_view(), name="employer-team-invites"),
    path("jobs", EmployerJobListCreateView.as_view(), name="employer-jobs"),
    path("jobs/<int:pk>", EmployerJobDetailView.as_view(), name="employer-job-detail"),
    path("all", JobListView.as_view(), name="jobs-all"),
    path("search", JobSearchView.as_view(), name="jobs-search"),
]
