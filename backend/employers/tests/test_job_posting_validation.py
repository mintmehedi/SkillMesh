from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class JobPostingValidationTests(APITestCase):
    """Integration: employer job POST returns per-field errors for invalid publish payload."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="jobs@employer.test",
            username="job_employer",
            password="TestPass123!",
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("employer-jobs")

    def test_post_open_job_without_title_or_jd_returns_field_errors(self):
        payload = {
            "title": "",
            "jd_text": "",
            "status": "open",
            "work_mode": "onsite",
            "location": "Sydney",
            "required_experience": 0,
            "compensation_period": "not_specified",
            "skills": [],
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", res.data)
        self.assertIn("jd_text", res.data)

    def test_post_draft_job_allows_blank_title_and_jd(self):
        payload = {
            "title": "",
            "jd_text": "",
            "status": "draft",
            "work_mode": "remote",
            "location": "",
            "required_experience": 0,
            "compensation_period": "not_specified",
            "skills": [],
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["status"], "draft")
