from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CandidateMembership
from candidates.models import CandidateProfile, CandidateSkill, WorkExperience
from employers.models import JobCategory, JobPosting, JobSkill
from matching.services import recommend_jobs_for_candidate, score_candidate_for_job


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

    def test_location_and_work_title_boost_matching_job(self):
        candidate_user = User.objects.create_user(
            email="loc@example.com", username="loccand", password="pass12345", role="candidate"
        )
        employer_user = User.objects.create_user(
            email="locemp@example.com", username="locemp", password="pass12345", role="employer"
        )
        candidate = CandidateProfile.objects.create(
            user=candidate_user,
            full_name="Sydney Nurse",
            headline="Registered nurse — acute care",
            location="Sydney",
            postcode="2000",
            summary="Ward experience and patient advocacy",
        )
        CandidateSkill.objects.create(candidate=candidate, skill_name="patient care", level=4)
        WorkExperience.objects.create(
            candidate=candidate,
            job_title="Registered Nurse",
            company_name="Metro Hospital",
            description="Acute medical ward",
            start_date="2020-03-01",
            is_current=True,
            sort_order=0,
        )
        cat = JobCategory.objects.create(slug="nursing", name="Healthcare", sort_order=1)
        local_job = JobPosting.objects.create(
            employer=employer_user,
            job_category=cat,
            title="Registered Nurse",
            jd_text="Acute ward patient care in Sydney",
            location="Sydney NSW",
            required_experience=1,
            status="open",
        )
        JobSkill.objects.create(job=local_job, skill_name="patient care", weight=3)
        remote_job = JobPosting.objects.create(
            employer=employer_user,
            title="Cobol Developer",
            jd_text="Legacy systems",
            location="Perth WA",
            required_experience=0,
            status="open",
        )
        JobSkill.objects.create(job=remote_job, skill_name="cobol", weight=2)

        local_score, local_exp = score_candidate_for_job(candidate, local_job)
        remote_score, remote_exp = score_candidate_for_job(candidate, remote_job)
        self.assertGreater(local_score, remote_score)
        self.assertTrue(local_exp["location_match"])
        self.assertGreater(local_exp.get("title_role_hits", 0), 0)
        self.assertIn("patient care", local_exp["matched_skills"])

        results = recommend_jobs_for_candidate(candidate_user, top_k=3)
        self.assertEqual(results[0]["job_id"], local_job.id)


class MatchingMembershipApiTests(APITestCase):
    def setUp(self):
        self.candidate_user = User.objects.create_user(
            email="candapi@example.com", username="candapi", password="pass12345", role="candidate"
        )
        self.employer_user = User.objects.create_user(
            email="empapi@example.com", username="empapi", password="pass12345", role="employer"
        )
        candidate = CandidateProfile.objects.create(user=self.candidate_user, full_name="Cand Api", preferred_mode="remote")
        CandidateSkill.objects.create(candidate=candidate, skill_name="python", level=3)
        cat = JobCategory.objects.create(slug="api-dev", name="Software API", sort_order=2)
        for i in range(12):
            job = JobPosting.objects.create(
                employer=self.employer_user,
                job_category=cat,
                title=f"Python Engineer {i}",
                jd_text="Python backend django rest",
                required_experience=1,
                work_mode="remote",
                status="open",
            )
            JobSkill.objects.create(job=job, skill_name="python", weight=3)
        self.client.force_authenticate(user=self.candidate_user)

    def test_free_plan_is_limited_to_ten_results(self):
        res = self.client.get("/api/recommendations/jobs-for-candidate")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_limited"])
        self.assertEqual(len(res.data["results"]), 10)

    def test_premium_plan_gets_full_recommendation_list(self):
        CandidateMembership.objects.create(
            user=self.candidate_user,
            plan_type=CandidateMembership.PlanType.PREMIUM,
            status=CandidateMembership.Status.ACTIVE,
        )
        res = self.client.get("/api/recommendations/jobs-for-candidate")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["is_limited"])
        self.assertGreaterEqual(len(res.data["results"]), 11)
