from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from candidates.models import CandidateProfile

User = get_user_model()


class CandidateAccessControlTests(APITestCase):
    def setUp(self):
        self.employer = User.objects.create_user(
            email="employer@example.com",
            username="employer1",
            password="SecurePass1!",
            role=User.Role.EMPLOYER,
        )
        self.candidate_user = User.objects.create_user(
            email="candidate@example.com",
            username="cand1",
            password="SecurePass1!",
            role=User.Role.CANDIDATE,
        )
        CandidateProfile.objects.create(
            user=self.candidate_user,
            full_name="Jane Candidate",
            location="Sydney",
            mobile_number="0400000000",
        )

    def test_candidate_cannot_search_profiles(self):
        self.client.force_authenticate(user=self.candidate_user)
        res = self.client.get("/api/candidates/search?location=sydney")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_employer_search_omits_sensitive_fields(self):
        self.client.force_authenticate(user=self.employer)
        res = self.client.get("/api/candidates/search?location=sydney")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        row = res.data[0]
        self.assertNotIn("mobile_number", row)
        self.assertNotIn("date_of_birth", row)
        self.assertNotIn("postcode", row)
        self.assertIn("full_name", row)
