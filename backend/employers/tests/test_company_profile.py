from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from employers.models import CompanyProfile

User = get_user_model()


class CompanyProfileOnboardingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="e@company.test",
            username="employer_co",
            password="TestPass123!",
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("company-profile")

    def test_initial_post_requires_complete_payload(self):
        res = self.client.post(self.url, {"company_name": "Acme"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(CompanyProfile.objects.filter(user=self.user).exists())

    def test_initial_post_creates_profile_and_marks_completed(self):
        payload = {
            "company_name": "Acme Robotics Pty Ltd",
            "description": "We build autonomous systems for logistics and warehousing.",
            "website": "https://acme.example",
            "location": "Sydney, NSW",
            "industry": "Technology",
            "company_size": "11-50",
            "founded_year": 2018,
            "phone": "+61 2 9000 0000",
            "contact_email": "careers@acme.example",
            "country": "Australia",
            "country_code": "AU",
            "state_region": "NSW",
            "city": "Sydney",
            "suburb": "Parramatta",
            "street_address": "100 George Street",
            "postcode": "2150",
            "business_registration_number": "12 345 678 901",
            "linkedin_url": "",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get("profile_completed"))
        row = CompanyProfile.objects.get(user=self.user)
        self.assertTrue(row.profile_completed)
        self.assertEqual(row.company_name, "Acme Robotics Pty Ltd")
        self.assertEqual(row.city, "Sydney")
        self.assertEqual(row.suburb, "Parramatta")

    def test_partial_update_does_not_require_all_fields(self):
        CompanyProfile.objects.create(
            user=self.user,
            company_name="Beta Ltd",
            profile_completed=True,
        )
        res = self.client.post(
            self.url,
            {"website": "https://beta.example"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        row = CompanyProfile.objects.get(user=self.user)
        self.assertEqual(row.website, "https://beta.example")
