from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from candidates.models import CandidateProfile, WorkExperience

User = get_user_model()


class ProfileBundleValidationTests(APITestCase):
    """Integration: bundle PUT validates education/work rows and returns indexed field errors."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="bundle@cand.test",
            username="bundle_cand",
            password="TestPass123!",
            role=User.Role.CANDIDATE,
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("candidate-profile-bundle")
        CandidateProfile.objects.create(
            user=self.user,
            full_name="Bundle Tester",
            onboarding_step=CandidateProfile.OnboardingStep.RESUME,
        )

    def test_work_experience_end_before_start_returns_row_error(self):
        payload = {
            "work_experiences": [
                {
                    "job_title": "Engineer",
                    "company_name": "Acme",
                    "description": "",
                    "start_date": "2024-06-01",
                    "end_date": "2023-01-01",
                    "is_current": False,
                    "sort_order": 0,
                }
            ],
            "education_entries": [],
        }
        res = self.client.put(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        work_err = res.data["work_experiences"]
        self.assertIsInstance(work_err, list)
        self.assertIn("non_field_errors", work_err[0])
        self.assertIn("End date cannot be before start date.", work_err[0]["non_field_errors"])

    def test_education_end_before_start_returns_row_error(self):
        payload = {
            "work_experiences": [],
            "education_entries": [
                {
                    "institution": "Uni",
                    "degree": "BSc",
                    "field_of_study": "",
                    "major": "",
                    "description": "",
                    "start_date": "2022-02-01",
                    "end_date": "2021-12-01",
                    "is_current": False,
                    "sort_order": 0,
                }
            ],
        }
        res = self.client.put(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        edu_err = res.data["education_entries"]
        self.assertIn("non_field_errors", edu_err[0])

    def test_valid_work_experience_replaces_rows(self):
        payload = {
            "work_experiences": [
                {
                    "job_title": "Developer",
                    "company_name": "Beta Co",
                    "description": "Built APIs",
                    "start_date": "2022-01-01",
                    "end_date": "2024-01-01",
                    "is_current": False,
                    "sort_order": 0,
                }
            ],
            "education_entries": [],
        }
        res = self.client.put(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        profile = CandidateProfile.objects.get(user=self.user)
        self.assertEqual(profile.work_experiences.count(), 1)
        row = WorkExperience.objects.get(candidate=profile)
        self.assertEqual(row.job_title, "Developer")
        self.assertEqual(profile.onboarding_step, CandidateProfile.OnboardingStep.CATEGORIES)
