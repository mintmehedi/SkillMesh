from rest_framework import permissions, views
from rest_framework.response import Response

from accounts.permissions import IsEmployer
from .models import RecommendationLog
from .services import recommend_candidates_for_job, recommend_jobs_for_candidate


class JobsForCandidateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        results = recommend_jobs_for_candidate(request.user, top_k=10)
        for row in results:
            RecommendationLog.objects.create(
                subject_type="candidate",
                subject_id=request.user.id,
                target_id=row["job_id"],
                score=row["score"],
                explanation_json=row["explanation"],
            )
        return Response(results)


class CandidatesForJobView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get(self, request, job_id):
        results = recommend_candidates_for_job(job_id, top_n=10)
        for row in results:
            RecommendationLog.objects.create(
                subject_type="job",
                subject_id=job_id,
                target_id=row["candidate_id"],
                score=row["score"],
                explanation_json=row["explanation"],
            )
        return Response(results)
