from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CandidateMembership
from candidates.models import CandidateProfile, CandidateSavedSearch, ResumeDocument

User = get_user_model()


class CandidatePremiumFeatureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="premium-test@example.com",
            username="premium_test",
            password="pass12345",
            role="candidate",
        )
        CandidateProfile.objects.create(user=self.user, full_name="Premium Test")
        self.client.force_authenticate(user=self.user)

    def test_saved_search_requires_premium(self):
        res = self.client.get("/api/candidates/saved-searches/")
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)

    def test_saved_search_allows_premium(self):
        CandidateMembership.objects.create(
            user=self.user,
            plan_type=CandidateMembership.PlanType.PREMIUM,
            status=CandidateMembership.Status.ACTIVE,
        )
        create = self.client.post(
            "/api/candidates/saved-searches/",
            {"label": "Python in Sydney", "payload": {"keyword": "python", "location": "Sydney"}},
            format="json",
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CandidateSavedSearch.objects.count(), 1)

    def test_free_plan_resume_listing_shows_only_one(self):
        profile = CandidateProfile.objects.get(user=self.user)
        ResumeDocument.objects.create(candidate=profile, file="resumes/a.pdf", display_name="A")
        ResumeDocument.objects.create(candidate=profile, file="resumes/b.pdf", display_name="B")
        res = self.client.get("/api/candidates/resume/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
