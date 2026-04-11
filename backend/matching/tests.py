from django.contrib.auth import get_user_model
from django.test import TestCase

from candidates.models import CandidateProfile, CandidateSkill
from employers.models import JobPosting, JobSkill
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
