from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

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
        self.assertIn("access", login_res.data)

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
