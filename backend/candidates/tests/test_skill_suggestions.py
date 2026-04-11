from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from candidates.skill_suggestions import suggest_skill_names

User = get_user_model()


class SuggestSkillNamesTests(TestCase):
    @patch("candidates.skill_suggestions.fetch_esco_skill_labels")
    def test_empty_db_esco_fills_at_least_three(self, mock_esc):
        mock_esc.return_value = ["Facilitate Brainstorming", "Manage Data", "Use Coding Techniques"]
        out = suggest_skill_names("br", from_jobs=[], from_candidates=[], limit=12)
        self.assertGreaterEqual(len(out), 3)
        for name in mock_esc.return_value:
            self.assertIn(name, out)

    def test_curated_prefix_when_no_esc(self):
        with patch("candidates.skill_suggestions.fetch_esco_skill_labels", return_value=[]):
            out = suggest_skill_names("py", from_jobs=[], from_candidates=[], limit=12)
        self.assertIn("Python", out)


class SkillSuggestApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="suggest_tester",
            email="suggest_tester@example.com",
            password="test-pass-123",
        )

    @patch("candidates.skill_suggestions.fetch_esco_skill_labels")
    def test_authenticated_returns_array_of_objects(self, mock_esc):
        mock_esc.return_value = ["Skill One", "Skill Two", "Skill Three"]
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/candidates/skills/suggest/?q=ab")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 3)
        self.assertTrue(all("skill_name" in row for row in data))

    def test_short_query_returns_empty(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/candidates/skills/suggest/?q=p")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

    def test_requires_auth(self):
        res = self.client.get("/api/candidates/skills/suggest/?q=py")
        self.assertEqual(res.status_code, 401)
