import os
from unittest.mock import patch

from django.test import SimpleTestCase

import candidates.resume_llm as resume_llm
from candidates.resume_llm import (
    apply_llm_work_experiences_if_configured,
    validate_and_normalize_llm_studies,
    validate_and_normalize_llm_work_experiences,
)


class ValidateLlmWorkExperiencesTests(SimpleTestCase):
    def test_drops_short_title_and_requires_signal(self):
        rows = [
            {"job_title": "X", "company_name": "Acme Ltd", "start_date": None},
            {"job_title": "", "company_name": "Only Co"},
            {
                "job_title": "Engineer",
                "company_name": "",
                "start_date": "2022-03-01",
                "end_date": None,
                "is_current": False,
            },
        ]
        out = validate_and_normalize_llm_work_experiences(rows)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["job_title"], "Engineer")
        self.assertEqual(out[0]["start_date"], "2022-03-01")

    def test_current_clears_end_date(self):
        rows = [
            {
                "job_title": "Consultant",
                "company_name": "Beta",
                "start_date": "2024-01-01",
                "end_date": "2025-01-01",
                "is_current": True,
            }
        ]
        out = validate_and_normalize_llm_work_experiences(rows)
        self.assertTrue(out[0]["is_current"])
        self.assertEqual(out[0]["end_date"], "")

    def test_caps_rows(self):
        rows = [{"job_title": f"Role {i}", "company_name": "C"} for i in range(12)]
        out = validate_and_normalize_llm_work_experiences(rows)
        self.assertEqual(len(out), 8)

    def test_accepts_title_with_substantial_description_no_company(self):
        rows = [
            {
                "job_title": "STEM Mentor",
                "company_name": "",
                "description": "Volunteer weekly sessions mentoring secondary students in mathematics.",
                "start_date": None,
                "end_date": None,
                "is_current": False,
            }
        ]
        out = validate_and_normalize_llm_work_experiences(rows)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["job_title"], "STEM Mentor")


class ValidateLlmStudiesTests(SimpleTestCase):
    def test_major_defaults_to_field_of_study(self):
        rows = [{"institution": "Uni", "degree": "BSc", "field_of_study": "CS", "major": ""}]
        out = validate_and_normalize_llm_studies(rows)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["major"], "CS")


class ApplyLlmWorkExperiencesTests(SimpleTestCase):
    def test_noop_when_llm_disabled(self):
        base = {
            "skills": [],
            "education_level": "",
            "work_experiences": [{"job_title": "Heuristic", "company_name": "Co"}],
            "experience_parse_confidence": 0.4,
            "parsed_at": "2026-01-01T00:00:00",
        }
        with patch.dict(
            os.environ,
            {
                "RESUME_LLM_ENABLED": "false",
                "OPENAI_API_KEY": "",
                "LLM_API_KEY": "",
            },
            clear=False,
        ):
            out = apply_llm_work_experiences_if_configured(base, "some resume text " * 20)
        self.assertEqual(out["work_experiences"], base["work_experiences"])
        self.assertNotIn("_parse_meta", out)

    @patch.object(resume_llm, "fetch_llm_resume_enrichment")
    @patch.object(resume_llm, "llm_work_experience_configured", return_value=True)
    def test_replaces_when_llm_returns_rows(self, _mock_cfg, mock_fetch):
        mock_fetch.return_value = (
            [
                {
                    "job_title": "LLM Title",
                    "company_name": "LLM Co",
                    "description": "Did things",
                    "start_date": "2020-01-01",
                    "end_date": "",
                    "is_current": True,
                    "sort_order": 0,
                }
            ],
            [],
        )
        base = {
            "skills": [],
            "education_level": "",
            "work_experiences": [],
            "experience_parse_confidence": 0.3,
            "parsed_at": "2026-01-01T00:00:00",
        }
        out = apply_llm_work_experiences_if_configured(base, "resume body " * 30)
        self.assertEqual(out["work_experiences"][0]["job_title"], "LLM Title")
        self.assertGreaterEqual(out["experience_parse_confidence"], 0.85)
        self.assertEqual(out["_parse_meta"]["work_experience_source"], "llm")

    @patch.object(resume_llm, "fetch_llm_resume_enrichment")
    @patch.object(resume_llm, "llm_work_experience_configured", return_value=True)
    def test_keeps_heuristic_when_llm_has_fewer_rows(self, _mock_cfg, mock_fetch):
        mock_fetch.return_value = (
            [
                {
                    "job_title": "Only LLM",
                    "company_name": "X",
                    "description": "",
                    "start_date": "2020-01-01",
                    "end_date": "",
                    "is_current": False,
                    "sort_order": 0,
                }
            ],
            [],
        )
        base = {
            "skills": [],
            "education_level": "",
            "work_experiences": [
                {"job_title": "A", "company_name": "Co1", "description": "", "start_date": "", "end_date": "", "is_current": False, "sort_order": 0},
                {"job_title": "B", "company_name": "Co2", "description": "", "start_date": "", "end_date": "", "is_current": False, "sort_order": 1},
            ],
            "experience_parse_confidence": 0.55,
            "parsed_at": "2026-01-01T00:00:00",
        }
        out = apply_llm_work_experiences_if_configured(base, "resume body " * 30)
        self.assertEqual(len(out["work_experiences"]), 2)
        self.assertEqual(out["work_experiences"][0]["job_title"], "A")
        self.assertEqual(out["_parse_meta"]["work_experience_source"], "heuristic")
        self.assertEqual(out["_parse_meta"]["llm_skipped_reason"], "heuristic_has_more_or_equal_entries")

    @patch.object(resume_llm, "fetch_llm_resume_enrichment", return_value=None)
    @patch.object(resume_llm, "llm_work_experience_configured", return_value=True)
    def test_heuristic_meta_when_llm_empty(self, _mock_cfg, _mock_fetch):
        base = {
            "skills": [],
            "education_level": "",
            "work_experiences": [{"job_title": "Keep"}],
            "experience_parse_confidence": 0.5,
            "parsed_at": "2026-01-01T00:00:00",
        }
        out = apply_llm_work_experiences_if_configured(base, "resume body " * 30)
        self.assertEqual(out["work_experiences"][0]["job_title"], "Keep")
        self.assertEqual(out["_parse_meta"]["work_experience_source"], "heuristic")

    @patch.object(resume_llm, "fetch_llm_resume_enrichment")
    @patch.object(resume_llm, "llm_work_experience_configured", return_value=True)
    def test_merges_studies_when_heuristic_empty(self, _mock_cfg, mock_fetch):
        mock_fetch.return_value = (
            [],
            [
                {
                    "institution": "State U",
                    "degree": "BS",
                    "field_of_study": "Physics",
                    "major": "Physics",
                    "description": "",
                    "start_date": "2018-01-01",
                    "end_date": "2022-01-01",
                    "is_current": False,
                    "sort_order": 0,
                }
            ],
        )
        base = {
            "skills": [],
            "studies": [],
            "education_parse_confidence": 0.2,
            "parsed_at": "2026-01-01T00:00:00",
        }
        out = apply_llm_work_experiences_if_configured(base, "resume body " * 30)
        self.assertEqual(len(out["studies"]), 1)
        self.assertEqual(out["studies"][0]["institution"], "State U")
        self.assertGreaterEqual(float(out["education_parse_confidence"]), 0.85)
        self.assertEqual(out["_parse_meta"]["studies_source"], "llm")
