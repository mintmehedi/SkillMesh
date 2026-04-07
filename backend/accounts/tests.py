from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class AuthFlowTests(APITestCase):
    def test_register_and_login(self):
        register_url = reverse("register")
        payload = {
            "email": "candidate@test.com",
            "username": "candidate1",
            "password": "StrongPass123",
            "role": "candidate",
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
