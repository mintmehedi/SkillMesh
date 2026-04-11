from django.db.models import prefetch_related_objects
from rest_framework import serializers

from candidates.serializers import CandidateProfileSerializer
from employers.models import JobPosting
from .models import Application


class EmployerJobBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobPosting
        fields = ("id", "title", "company_info", "location", "work_mode", "status")


class EmployerApplicationListSerializer(serializers.ModelSerializer):
    job = EmployerJobBriefSerializer(read_only=True)
    candidate_name = serializers.SerializerMethodField()
    has_cover_letter_file = serializers.SerializerMethodField()
    has_resume = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = (
            "id",
            "created_at",
            "status",
            "job",
            "candidate_name",
            "cover_letter_mode",
            "has_cover_letter_file",
            "has_resume",
        )

    def get_candidate_name(self, obj):
        profile = getattr(obj.candidate, "candidate_profile", None)
        if profile and (profile.full_name or "").strip():
            return profile.full_name.strip()
        return obj.candidate.email or obj.candidate.username

    def get_has_cover_letter_file(self, obj):
        return bool(obj.cover_letter_file)

    def get_has_resume(self, obj):
        return obj.resume_id is not None


class EmployerApplicationDetailSerializer(serializers.ModelSerializer):
    job = EmployerJobBriefSerializer(read_only=True)
    candidate_profile = serializers.SerializerMethodField()
    resume = serializers.SerializerMethodField()
    cover_letter = serializers.SerializerMethodField()
    candidate_contact = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = (
            "id",
            "created_at",
            "status",
            "job",
            "candidate_profile",
            "resume",
            "cover_letter",
            "candidate_contact",
        )

    def get_candidate_profile(self, obj):
        profile = getattr(obj.candidate, "candidate_profile", None)
        if not profile:
            return None
        prefetch_related_objects(
            [profile],
            "skills",
            "work_experiences",
            "education_entries",
            "preferred_job_categories",
        )
        return CandidateProfileSerializer(profile).data

    def get_resume(self, obj):
        if not obj.resume_id or not obj.resume:
            return None
        return {
            "id": obj.resume.id,
            "display_name": obj.resume.display_name or "Resume",
            "download_path": f"/api/employers/applications/{obj.pk}/resume/",
        }

    def get_cover_letter(self, obj):
        out = {
            "mode": obj.cover_letter_mode,
            "text": obj.cover_letter_text if obj.cover_letter_mode == Application.CoverLetterMode.IN_APP else "",
            "download_path": (
                f"/api/employers/applications/{obj.pk}/cover-letter/"
                if obj.cover_letter_mode == Application.CoverLetterMode.UPLOAD and obj.cover_letter_file
                else None
            ),
        }
        return out

    def get_candidate_contact(self, obj):
        profile = getattr(obj.candidate, "candidate_profile", None)
        phone = ""
        if profile:
            phone = (profile.mobile_number or "").strip() or (profile.contact or "").strip()
        return {
            "email": obj.candidate.email or "",
            "phone": phone,
        }
