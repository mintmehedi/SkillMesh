from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CandidateMembership, CompanyMembership

User = get_user_model()


class AuthFlowTests(APITestCase):
    def test_register_employer_and_login(self):
        register_url = reverse("register")
        payload = {
            "email": "employer@test.com",
            "username": "employer1",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "role": "employer",
        }
        register_res = self.client.post(register_url, payload, format="json")
        self.assertEqual(register_res.status_code, status.HTTP_201_CREATED)

        login_url = reverse("login")
        login_res = self.client.post(
            login_url,
            {"email": payload["email"], "password": payload["password"]},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, login_res.cookies)
        me_res = self.client.get(reverse("me"))
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)

    def test_logout_blacklists_refresh_cookie(self):
        user = User.objects.create_user(
            email="logout@test.com",
            username="logout_user",
            password="StrongPass123!",
            role=User.Role.EMPLOYER,
        )
        login_res = self.client.post(
            reverse("login"),
            {"email": user.email, "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        logout_res = self.client.post(reverse("logout"), {}, format="json")
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)
        # `delete_cookie` clears the value and expires the cookie rather than
        # dropping it from the jar, so assert it has been emptied.
        access_cookie = self.client.cookies.get(settings.JWT_ACCESS_COOKIE_NAME)
        self.assertIsNotNone(access_cookie)
        self.assertEqual(access_cookie.value, "")

    def test_employer_register_rejects_candidate_email(self):
        User.objects.create_user(
            email="cand@example.com",
            username="cand_user",
            password="x",
            role=User.Role.CANDIDATE,
        )
        register_url = reverse("register")
        res = self.client.post(
            register_url,
            {
                "email": "cand@example.com",
                "username": "newemp",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "role": "employer",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("candidate", str(res.data).lower())

    def test_username_availability_includes_existing_role_when_taken(self):
        User.objects.create_user(
            email="u1@example.com",
            username="taken_name",
            password="x",
            role=User.Role.EMPLOYER,
        )
        url = reverse("meta-username-availability")
        res = self.client.get(url, {"username": "taken_name"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["available"])
        self.assertEqual(res.data["existing_role"], "employer")


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


class EmployerMembershipApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="employer@example.com",
            username="employer_user",
            password="pass12345",
            role="employer",
        )
        self.client.force_authenticate(user=self.user)

    def test_membership_lifecycle(self):
        res = self.client.get("/api/auth/company-membership")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["plan_type"], "free")

        obtain = self.client.post("/api/auth/company-membership/obtain")
        self.assertEqual(obtain.status_code, status.HTTP_200_OK)
        self.assertEqual(obtain.data["plan_type"], "premium")

        cancel = self.client.post("/api/auth/company-membership/cancel")
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel.data["status"], "cancelled")

        renew = self.client.post("/api/auth/company-membership/renew")
        self.assertEqual(renew.status_code, status.HTTP_200_OK)
        self.assertEqual(renew.data["status"], "active")

        row = CompanyMembership.objects.get(user=self.user)
        self.assertEqual(row.plan_type, CompanyMembership.PlanType.PREMIUM)

    def test_teammate_cannot_manage_membership(self):
        owner = User.objects.create_user(
            email="owner-mem@example.com",
            username="owner_mem",
            password="pass12345",
            role="employer",
        )
        teammate = User.objects.create_user(
            email="mate-mem@example.com",
            username="mate_mem",
            password="pass12345",
            role="employer",
            employer_organization_owner=owner,
        )
        self.client.force_authenticate(user=teammate)
        res = self.client.post("/api/auth/company-membership/obtain")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(CompanyMembership.objects.filter(user=owner).exists())
