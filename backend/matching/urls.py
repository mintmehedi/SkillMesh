from django.urls import path

from .views import CandidatesForJobView, JobsForCandidateView

urlpatterns = [
    path("jobs-for-candidate", JobsForCandidateView.as_view(), name="jobs-for-candidate"),
    path("candidates-for-job/<int:job_id>", CandidatesForJobView.as_view(), name="candidates-for-job"),
]
