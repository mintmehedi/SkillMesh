from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CandidateMembership

User = get_user_model()


class MembershipApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="member@example.com",
            username="member_user",
            password="pass12345",
            role="candidate",
        )
        self.client.force_authenticate(user=self.user)

    def test_membership_lifecycle(self):
        res = self.client.get("/api/auth/membership")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["plan_type"], "free")

        obtain = self.client.post("/api/auth/membership/obtain")
        self.assertEqual(obtain.status_code, status.HTTP_200_OK)
        self.assertEqual(obtain.data["plan_type"], "premium")

        cancel = self.client.post("/api/auth/membership/cancel")
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel.data["status"], "cancelled")

        renew = self.client.post("/api/auth/membership/renew")
        self.assertEqual(renew.status_code, status.HTTP_200_OK)
        self.assertEqual(renew.data["status"], "active")

        row = CandidateMembership.objects.get(user=self.user)
        self.assertEqual(row.plan_type, CandidateMembership.PlanType.PREMIUM)
