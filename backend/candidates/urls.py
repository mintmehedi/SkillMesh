from django.urls import path

from .views import (
    CandidateListView,
    CandidateOnboardingAdvanceView,
    CandidateProfileBundleView,
    CandidateProfileUpsertView,
    CandidateSearchView,
    EducationBulkView,
    JobCategoryListView,
    ResumeDetailView,
    ResumeDownloadView,
    ResumeListView,
    ResumeReprocessView,
    ResumeUploadView,
    SkillSuggestView,
    WorkExperienceBulkView,
)


urlpatterns = [
    path("profile/bundle/", CandidateProfileBundleView.as_view(), name="candidate-profile-bundle"),
    path("profile", CandidateProfileUpsertView.as_view(), name="candidate-profile"),
    path("list", CandidateListView.as_view(), name="candidate-list"),
    path("search", CandidateSearchView.as_view(), name="candidate-search"),
    path("job-categories/", JobCategoryListView.as_view(), name="job-categories"),
    path("education/", EducationBulkView.as_view(), name="education"),
    path("work-experience/", WorkExperienceBulkView.as_view(), name="work-experience"),
    path("skills/suggest/", SkillSuggestView.as_view(), name="skill-suggest"),
    path("resume/upload", ResumeUploadView.as_view(), name="resume-upload"),
    path("resume/reprocess/<int:resume_id>", ResumeReprocessView.as_view(), name="resume-reprocess"),
    path("resume/", ResumeListView.as_view(), name="resume-list"),
    path("resume/<int:pk>/download/", ResumeDownloadView.as_view(), name="resume-download"),
    path("resume/<int:pk>/", ResumeDetailView.as_view(), name="resume-detail"),
    path("onboarding/advance", CandidateOnboardingAdvanceView.as_view(), name="candidate-onboarding-advance"),
]
