from django.urls import path

from .views import (
    CandidateListView,
    CandidateProfileUpsertView,
    CandidateSearchView,
    JobCategoryListView,
    ResumeReprocessView,
    ResumeUploadView,
    WorkExperienceBulkView,
)


urlpatterns = [
    path("profile", CandidateProfileUpsertView.as_view(), name="candidate-profile"),
    path("list", CandidateListView.as_view(), name="candidate-list"),
    path("search", CandidateSearchView.as_view(), name="candidate-search"),
    path("job-categories/", JobCategoryListView.as_view(), name="job-categories"),
    path("work-experience/", WorkExperienceBulkView.as_view(), name="work-experience"),
    path("resume/upload", ResumeUploadView.as_view(), name="resume-upload"),
    path("resume/reprocess/<int:resume_id>", ResumeReprocessView.as_view(), name="resume-reprocess"),
]
