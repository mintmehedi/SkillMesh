from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from applications.models import Application
from candidates.models import CandidateProfile, ResumeDocument
from employers.models import CompanyProfile, JobCategory, JobPosting

User = get_user_model()


class ApplicationFlowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.employer = User.objects.create_user(
            email="emp-app@example.com",
            username="emp_app",
            password="TestPass123!",
            role=User.Role.EMPLOYER,
        )
        CompanyProfile.objects.create(
            user=cls.employer,
            company_name="AppCo",
            profile_completed=True,
        )
        cls.cat = JobCategory.objects.create(slug="qa-app", name="QA", sort_order=1)
        cls.job_open = JobPosting.objects.create(
            employer=cls.employer,
            job_category=cls.cat,
            title="Open Role",
            jd_text="Do things.",
            company_info="AppCo",
            work_mode=JobPosting.WorkMode.REMOTE,
            location="Remote",
            status="open",
        )
        cls.job_open_b = JobPosting.objects.create(
            employer=cls.employer,
            job_category=cls.cat,
            title="Open Role B",
            jd_text="Do more.",
            company_info="AppCo",
            work_mode=JobPosting.WorkMode.REMOTE,
            location="Remote",
            status="open",
        )
        cls.job_open_c = JobPosting.objects.create(
            employer=cls.employer,
            job_category=cls.cat,
            title="Open Role C",
            jd_text="List inbox.",
            company_info="AppCo",
            work_mode=JobPosting.WorkMode.REMOTE,
            location="Remote",
            status="open",
        )
        cls.job_draft = JobPosting.objects.create(
            employer=cls.employer,
            job_category=cls.cat,
            title="Draft Role",
            jd_text="Hidden.",
            company_info="AppCo",
            work_mode=JobPosting.WorkMode.REMOTE,
            location="Remote",
            status="draft",
        )

        cls.candidate = User.objects.create_user(
            email="cand-app@example.com",
            username="cand_app",
            password="TestPass123!",
            role=User.Role.CANDIDATE,
        )
        cls.profile = CandidateProfile.objects.create(
            user=cls.candidate,
            full_name="Candidate One",
            mobile_number="+61 400 000 000",
        )
        cls.resume = ResumeDocument.objects.create(
            candidate=cls.profile,
            display_name="Main CV",
            file=SimpleUploadedFile("cv.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
            raw_text="skills",
        )

        cls.other = User.objects.create_user(
            email="other@example.com",
            username="other_c",
            password="TestPass123!",
            role=User.Role.CANDIDATE,
        )
        cls.other_profile = CandidateProfile.objects.create(user=cls.other, full_name="Other")
        cls.other_resume = ResumeDocument.objects.create(
            candidate=cls.other_profile,
            display_name="Other CV",
            file=SimpleUploadedFile("o.pdf", b"%PDF-1.4 other", content_type="application/pdf"),
            raw_text="x",
        )

        cls.employer2 = User.objects.create_user(
            email="emp2@example.com",
            username="emp2",
            password="TestPass123!",
            role=User.Role.EMPLOYER,
        )
        CompanyProfile.objects.create(user=cls.employer2, company_name="OtherCo", profile_completed=True)
        cls.job_other = JobPosting.objects.create(
            employer=cls.employer2,
            job_category=cls.cat,
            title="Other org job",
            jd_text="x",
            company_info="OtherCo",
            work_mode=JobPosting.WorkMode.REMOTE,
            location="Remote",
            status="open",
        )
        cls.app_other = Application.objects.create(
            candidate=cls.candidate,
            job=cls.job_other,
            resume=cls.resume,
            cover_letter_mode=Application.CoverLetterMode.NONE,
        )

    def test_apply_requires_resume_and_live_job(self):
        self.client.force_authenticate(self.candidate)
        res = self.client.post(
            "/api/applications/",
            {"job": self.job_open.id, "resume": self.resume.id, "cover_letter_mode": "none"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["job"], self.job_open.id)
        self.assertEqual(res.data["resume"], self.resume.id)

    def test_cannot_apply_with_another_users_resume(self):
        self.client.force_authenticate(self.candidate)
        res = self.client.post(
            "/api/applications/",
            {"job": self.job_open_b.id, "resume": self.other_resume.id, "cover_letter_mode": "none"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_apply_to_draft_job(self):
        self.client.force_authenticate(self.candidate)
        res = self.client.post(
            "/api/applications/",
            {"job": self.job_draft.id, "resume": self.resume.id, "cover_letter_mode": "none"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_employer_lists_own_applications(self):
        Application.objects.create(
            candidate=self.candidate,
            job=self.job_open_c,
            resume=self.resume,
            cover_letter_mode=Application.CoverLetterMode.NONE,
        )
        self.client.force_authenticate(self.employer)
        res = self.client.get("/api/employers/applications")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["job"]["id"] == self.job_open_c.id for row in res.data))

    def test_employer_cannot_fetch_other_orgs_application_detail(self):
        self.client.force_authenticate(self.employer)
        res = self.client.get(f"/api/employers/applications/{self.app_other.id}")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
