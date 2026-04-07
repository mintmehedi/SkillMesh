from django.urls import path

from .views import CandidateListView, CandidateProfileUpsertView, CandidateSearchView, ResumeReprocessView, ResumeUploadView


urlpatterns = [
    path("profile", CandidateProfileUpsertView.as_view(), name="candidate-profile"),
    path("list", CandidateListView.as_view(), name="candidate-list"),
    path("search", CandidateSearchView.as_view(), name="candidate-search"),
    path("resume/upload", ResumeUploadView.as_view(), name="resume-upload"),
    path("resume/reprocess/<int:resume_id>", ResumeReprocessView.as_view(), name="resume-reprocess"),
]
