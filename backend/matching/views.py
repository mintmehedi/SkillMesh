from rest_framework import permissions, views
from rest_framework.response import Response

from accounts.membership import is_premium_candidate, is_premium_company
from accounts.permissions import IsEmployer
from employers.models import JobPosting
from employers.utils_workspace import workspace_owner
from .models import RecommendationLog
from .services import recommend_candidates_for_job, recommend_jobs_for_candidate


class JobsForCandidateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        results = recommend_jobs_for_candidate(request.user)
        premium = is_premium_candidate(request.user)
        limit = None if premium else 10
        capped = results if limit is None else results[:limit]
        # Avoid writing one DB row per job on every page load when the list is long.
        for row in capped[:40]:
            RecommendationLog.objects.create(
                subject_type="candidate",
                subject_id=request.user.id,
                target_id=row["job_id"],
                score=row["score"],
                explanation_json=row["explanation"],
            )
        return Response(
            {
                "results": capped,
                "is_limited": (not premium) and len(results) > len(capped),
                "upgrade_cta": (not premium) and len(results) > len(capped),
                "total_matches": len(results),
            }
        )


class CandidatesForJobView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get(self, request, job_id):
        job = JobPosting.objects.filter(pk=job_id).first()
        if not job or job.employer_id != workspace_owner(request.user).id:
            return Response({"detail": "Job not found."}, status=404)
        premium = is_premium_company(request.user)
        results = recommend_candidates_for_job(job_id, top_n=None)
        limit = None if premium else 10
        capped = results if limit is None else results[:limit]
        for row in capped[:40]:
            RecommendationLog.objects.create(
                subject_type="job",
                subject_id=job_id,
                target_id=row["candidate_id"],
                score=row["score"],
                explanation_json=row["explanation"],
            )
        return Response(
            {
                "results": capped,
                "is_limited": (not premium) and len(results) > len(capped),
                "upgrade_cta": (not premium) and len(results) > len(capped),
                "total_matches": len(results),
            }
        )
