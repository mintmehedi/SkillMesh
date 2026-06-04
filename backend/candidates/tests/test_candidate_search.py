from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from candidates.models import CandidateEducation, CandidateProfile, CandidateSkill, WorkExperience
from employers.models import JobCategory

User = get_user_model()


class CandidateSearchApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.employer = User.objects.create_user(
            email="hire@example.com",
            username="hire_co",
            password="TestPass123!",
            role=User.Role.EMPLOYER,
        )
        cls.cat_nurse = JobCategory.objects.create(slug="nurse", name="Nursing", sort_order=1)
        cls.cat_dev = JobCategory.objects.create(slug="dev", name="Software", sort_order=2)

        cand_a = User.objects.create_user(
            email="alice@example.com",
            username="alice",
            password="TestPass123!",
            role=User.Role.CANDIDATE,
        )
        cls.profile_a = CandidateProfile.objects.create(
            user=cand_a,
            full_name="Alice Nguyen",
            headline="Senior RN",
            location="Melbourne VIC",
            education_level="Bachelor",
            major="Nursing",
            summary="Ward and community care.",
            preferred_mode="hybrid",
        )
        CandidateSkill.objects.create(candidate=cls.profile_a, skill_name="Patient care")
        CandidateSkill.objects.create(candidate=cls.profile_a, skill_name="IV therapy")
        WorkExperience.objects.create(
            candidate=cls.profile_a,
            job_title="Registered Nurse",
            company_name="Metro Health",
            description="Emergency department rotations.",
        )
        CandidateEducation.objects.create(
            candidate=cls.profile_a,
            institution="Monash University",
            degree="Bachelor of Nursing",
            field_of_study="Nursing",
        )
        cls.profile_a.preferred_job_categories.add(cls.cat_nurse)

        cand_b = User.objects.create_user(
            email="bob@example.com",
            username="bob",
            password="TestPass123!",
            role=User.Role.CANDIDATE,
        )
        cls.profile_b = CandidateProfile.objects.create(
            user=cand_b,
            full_name="Bob Chen",
            headline="Full-stack developer",
            location="Brisbane QLD",
            education_level="Master",
            major="Computer Science",
            summary="Python and React.",
            preferred_mode="remote",
        )
        CandidateSkill.objects.create(candidate=cls.profile_b, skill_name="Python")
        CandidateSkill.objects.create(candidate=cls.profile_b, skill_name="React")
        WorkExperience.objects.create(
            candidate=cls.profile_b,
            job_title="Software Engineer",
            company_name="FinTech Co",
            description="API design and cloud deploys.",
        )
        cls.profile_b.preferred_job_categories.add(cls.cat_dev)

    def setUp(self):
        self.client.force_authenticate(user=self.employer)

    def test_keyword_matches_work_experience(self):
        res = self.client.get("/api/candidates/search", {"keyword": "Emergency department"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_a.id, ids)
        self.assertNotIn(self.profile_b.id, ids)

    def test_skills_filter(self):
        res = self.client.get("/api/candidates/search", {"skills": "Python"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_b.id, ids)
        self.assertNotIn(self.profile_a.id, ids)

    def test_education_matches_institution(self):
        res = self.client.get("/api/candidates/search", {"education": "Monash"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_a.id, ids)
        self.assertNotIn(self.profile_b.id, ids)

    def test_location_narrows_results(self):
        res = self.client.get("/api/candidates/search", {"location": "Brisbane"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_b.id, ids)
        self.assertNotIn(self.profile_a.id, ids)

    def test_category_filter(self):
        res = self.client.get("/api/candidates/search", {"category": str(self.cat_dev.id)})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_b.id, ids)
        self.assertNotIn(self.profile_a.id, ids)

    def test_preferred_mode_filter(self):
        res = self.client.get("/api/candidates/search", {"preferred_mode": "remote"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_b.id, ids)
        self.assertNotIn(self.profile_a.id, ids)

    def test_headline_match_ranks_above_summary_only(self):
        decoy_user = User.objects.create_user(
            email="decoy@example.com",
            username="decoy",
            password="TestPass123!",
            role=User.Role.CANDIDATE,
        )
        decoy = CandidateProfile.objects.create(
            user=decoy_user,
            full_name="Casey Lee",
            headline="Care assistant",
            summary="Previously worked as Senior RN in a volunteer capacity.",
            location="Perth WA",
        )
        res = self.client.get("/api/candidates/search", {"keyword": "Senior RN"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_a.id, ids)
        self.assertIn(decoy.id, ids)
        self.assertLess(ids.index(self.profile_a.id), ids.index(decoy.id))

    @override_settings(FEATURE_FLAGS={"enable_text_similarity": True})
    def test_fuzzy_keyword_matches_typo_in_skill_and_role(self):
        res = self.client.get("/api/candidates/search", {"keyword": "sofware enginer"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.profile_b.id, ids)
        self.assertLess(ids.index(self.profile_b.id), len(ids))
