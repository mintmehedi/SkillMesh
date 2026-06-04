from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CompanyMembership
from applications.models import Application
from employers.models import CompanyProfile, JobPosting

User = get_user_model()


class EmployerDashboardAnalyticsTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="analytics-owner@example.com",
            username="analytics_owner",
            password="pass12345",
            role="employer",
        )
        CompanyProfile.objects.create(
            user=self.owner,
            company_name="Chart Co",
            profile_completed=True,
        )
        self.job = JobPosting.objects.create(
            employer=self.owner,
            title="Engineer",
            jd_text="Python",
            status="open",
        )
        self.candidate = User.objects.create_user(
            email="analytics-cand@example.com",
            username="analytics_cand",
            password="pass12345",
            role="candidate",
        )
        Application.objects.create(candidate=self.candidate, job=self.job, status="applied")
        self.client.force_authenticate(user=self.owner)

    def test_free_plan_blocked(self):
        res = self.client.get("/api/employers/dashboard/analytics")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res.data.get("premium_required"))

    def test_premium_returns_charts(self):
        CompanyMembership.objects.create(
            user=self.owner,
            plan_type=CompanyMembership.PlanType.PREMIUM,
            status=CompanyMembership.Status.ACTIVE,
        )
        res = self.client.get("/api/employers/dashboard/analytics")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data.get("premium_required"))
        self.assertIn("charts", res.data)
        self.assertGreater(len(res.data["charts"]), 0)
        first = res.data["charts"][0]
        self.assertIn("image_base64", first)
        self.assertTrue(len(first["image_base64"]) > 100)
