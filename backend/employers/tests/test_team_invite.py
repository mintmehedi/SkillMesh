from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from employers.models import CompanyProfile, EmployerTeamInvite

User = get_user_model()


class EmployerTeamInviteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="Testpass!1",
            role=User.Role.EMPLOYER,
        )
        CompanyProfile.objects.create(
            user=self.owner,
            company_name="Acme Pty Ltd",
            description="We hire.",
            industry="Technology",
            company_size="11-50",
            location="Sydney",
            profile_completed=True,
        )

    def test_preview_invite(self):
        inv = EmployerTeamInvite.objects.create(
            email="mate@example.com",
            invited_by=self.owner,
            organization_owner=self.owner,
        )
        res = self.client.get(f"/api/employers/team/invite/{inv.token}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["email"], "mate@example.com")
        self.assertEqual(res.data["company_name"], "Acme Pty Ltd")

    def test_register_with_invite_links_workspace(self):
        inv = EmployerTeamInvite.objects.create(
            email="mate@example.com",
            invited_by=self.owner,
            organization_owner=self.owner,
        )
        payload = {
            "email": "mate@example.com",
            "username": "mateuser",
            "password": "Str0ng!pass",
            "password_confirm": "Str0ng!pass",
            "role": "employer",
            "employer_invite_token": str(inv.token),
        }
        res = self.client.post("/api/auth/register", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        mate = User.objects.get(email="mate@example.com")
        self.assertEqual(mate.employer_organization_owner_id, self.owner.id)
        inv.refresh_from_db()
        self.assertIsNotNone(inv.accepted_at)
