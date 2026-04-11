from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from employers.models import CompanyProfile, JobCategory, JobPosting

User = get_user_model()


class JobSearchApiTests(APITestCase):
    """Public job search with keyword, location, and filters."""

    @classmethod
    def setUpTestData(cls):
        cls.employer = User.objects.create_user(
            email="hire@example.com",
            username="hire_co",
            password="TestPass123!",
            role=User.Role.EMPLOYER,
        )
        CompanyProfile.objects.create(
            user=cls.employer,
            company_name="Acme",
            profile_completed=True,
            city="Melbourne",
            state_region="VIC",
            country="Australia",
            postcode="3000",
        )
        cls.cat_nurse = JobCategory.objects.create(slug="nurse", name="Nursing", sort_order=1)
        cls.cat_dev = JobCategory.objects.create(slug="dev", name="Software", sort_order=2)

        cls.job_melb = JobPosting.objects.create(
            employer=cls.employer,
            job_category=cls.cat_nurse,
            title="Registered Nurse",
            jd_text="Ward work in Melbourne metro.",
            location="Melbourne VIC",
            company_info="Acme Health",
            work_mode=JobPosting.WorkMode.HYBRID,
            status="open",
        )
        cls.job_bris = JobPosting.objects.create(
            employer=cls.employer,
            job_category=cls.cat_nurse,
            title="Registered Nurse",
            jd_text="Community nursing Brisbane.",
            location="Brisbane QLD",
            company_info="Acme Health",
            work_mode=JobPosting.WorkMode.ONSITE,
            status="open",
        )
        cls.job_remote = JobPosting.objects.create(
            employer=cls.employer,
            job_category=cls.cat_dev,
            title="Python Developer",
            jd_text="Remote-first team.",
            location="Remote",
            company_info="Acme Tech",
            work_mode=JobPosting.WorkMode.REMOTE,
            status="open",
        )

    def test_keyword_and_location_narrows_results(self):
        url = "/api/jobs/search"
        res = self.client.get(url, {"keyword": "Nurse", "location": "Melbourne"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.job_melb.id, ids)
        self.assertNotIn(self.job_bris.id, ids)

    def test_loc_terms_requires_each_token(self):
        url = "/api/jobs/search"
        res = self.client.get(url, {"keyword": "Nurse", "loc_terms": "melbourne,vic"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.job_melb.id, ids)
        self.assertNotIn(self.job_bris.id, ids)

    def test_category_filter(self):
        url = "/api/jobs/search"
        res = self.client.get(url, {"keyword": "Acme", "category": str(self.cat_dev.id)})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.job_remote.id, ids)
        self.assertNotIn(self.job_melb.id, ids)

    def test_work_mode_filter(self):
        url = "/api/jobs/search"
        res = self.client.get(url, {"keyword": "Nurse", "work_mode": "hybrid"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.job_melb.id, ids)
        self.assertNotIn(self.job_bris.id, ids)

    def test_location_only_search(self):
        url = "/api/jobs/search"
        res = self.client.get(url, {"location": "Brisbane"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data]
        self.assertIn(self.job_bris.id, ids)
        self.assertNotIn(self.job_melb.id, ids)
