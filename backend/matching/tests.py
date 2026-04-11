from django.contrib.auth import get_user_model
from django.test import TestCase

from candidates.models import CandidateProfile, CandidateSkill
from employers.models import JobCategory, JobPosting, JobSkill
from matching.services import recommend_jobs_for_candidate


User = get_user_model()


class MatchingServiceTests(TestCase):
    def test_recommend_jobs_returns_ranked_results(self):
        candidate_user = User.objects.create_user(
            email="cand@example.com", username="cand", password="pass12345", role="candidate"
        )
        employer_user = User.objects.create_user(
            email="emp@example.com", username="emp", password="pass12345", role="employer"
        )
        candidate = CandidateProfile.objects.create(user=candidate_user, full_name="Cand")
        CandidateSkill.objects.create(candidate=candidate, skill_name="python", level=3)

        job = JobPosting.objects.create(
            employer=employer_user,
            title="Python Dev",
            jd_text="Need python and django",
            required_experience=2,
            status="open",
        )
        JobSkill.objects.create(job=job, skill_name="python", weight=3)

        results = recommend_jobs_for_candidate(candidate_user, top_k=10)
        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0]["job_id"], job.id)

    def test_recommend_jobs_api_subset_uses_score_floor_and_min_ten(self):
        """Default (no top_k): ≥80% of best score, padded to at least 10 when enough jobs exist."""
        candidate_user = User.objects.create_user(
            email="cand2@example.com", username="cand2", password="pass12345", role="candidate"
        )
        employer_user = User.objects.create_user(
            email="emp2@example.com", username="emp2", password="pass12345", role="employer"
        )
        candidate = CandidateProfile.objects.create(user=candidate_user, full_name="Alex")
        CandidateSkill.objects.create(candidate=candidate, skill_name="python", level=3)
        cat = JobCategory.objects.create(slug="dev", name="Software", sort_order=1)

        strong = JobPosting.objects.create(
            employer=employer_user,
            job_category=cat,
            title="Senior Python",
            jd_text="Python required",
            required_experience=1,
            status="open",
        )
        JobSkill.objects.create(job=strong, skill_name="python", weight=3)

        weak_jobs = []
        for i in range(15):
            j = JobPosting.objects.create(
                employer=employer_user,
                title=f"Other role {i}",
                jd_text="Unrelated work",
                required_experience=0,
                status="open",
            )
            JobSkill.objects.create(job=j, skill_name="cobol", weight=2)
            weak_jobs.append(j)

        results = recommend_jobs_for_candidate(candidate_user)
        self.assertGreaterEqual(len(results), 10)
        self.assertEqual(results[0]["job_id"], strong.id)
        best = results[0]["score"]
        floor = 0.8 * best
        high = [r for r in results if r["score"] >= floor - 0.01]
        self.assertTrue(any(r["job_id"] == strong.id for r in high))
        for r in high:
            self.assertGreaterEqual(r["score"], floor - 0.02)
        if len(results) > len(high):
            self.assertLess(min(r["score"] for r in results), floor - 0.01)
