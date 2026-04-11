from pathlib import Path

from rest_framework import serializers

from candidates.models import ResumeDocument
from employers.models import JobPosting
from .models import Application


class ResumeBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeDocument
        fields = ("id", "display_name")


class ApplicationSerializer(serializers.ModelSerializer):
    """Candidate list/create: resume PK on write, nested brief on read."""

    resume_detail = ResumeBriefSerializer(source="resume", read_only=True)
    cover_letter = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "candidate",
            "job",
            "status",
            "created_at",
            "resume",
            "resume_detail",
            "cover_letter_mode",
            "cover_letter_text",
            "cover_letter",
            "cover_letter_file",
        )
        read_only_fields = (
            "id",
            "candidate",
            "created_at",
            "status",
            "resume_detail",
            "cover_letter_file",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            self.fields["resume"].queryset = ResumeDocument.objects.filter(candidate__user=request.user)

    def validate_job(self, job: JobPosting):
        if not JobPosting.objects.public_live().filter(pk=job.pk).exists():
            raise serializers.ValidationError("This job is not accepting applications.")
        return job

    def validate_resume(self, resume: ResumeDocument):
        user = self.context["request"].user
        if resume.candidate.user_id != user.id:
            raise serializers.ValidationError("Invalid resume selection.")
        return resume

    def validate(self, attrs):
        mode = attrs.get("cover_letter_mode", Application.CoverLetterMode.NONE)
        text = (attrs.get("cover_letter_text") or "").strip()
        attrs["cover_letter_text"] = text
        cover_upload = attrs.get("cover_letter")

        allowed_cv = (".pdf", ".docx")
        if cover_upload and cover_upload.name:
            suf = Path(cover_upload.name.lower()).suffix
            if suf not in allowed_cv:
                raise serializers.ValidationError(
                    {"cover_letter": "Cover letter must be a PDF or DOCX file."},
                )

        if mode == Application.CoverLetterMode.NONE:
            attrs["cover_letter_text"] = ""
            attrs.pop("cover_letter", None)
        elif mode == Application.CoverLetterMode.IN_APP:
            attrs.pop("cover_letter", None)
            if not text:
                raise serializers.ValidationError(
                    {"cover_letter_text": "Enter a cover letter or choose another option."},
                )
        elif mode == Application.CoverLetterMode.UPLOAD:
            if not cover_upload:
                raise serializers.ValidationError(
                    {"cover_letter": "Upload a cover letter file."},
                )

        return attrs

    def create(self, validated_data):
        cover_upload = validated_data.pop("cover_letter", None)
        mode = validated_data.get("cover_letter_mode", Application.CoverLetterMode.NONE)
        if mode == Application.CoverLetterMode.UPLOAD and cover_upload:
            validated_data["cover_letter_file"] = cover_upload
        elif "cover_letter_file" in validated_data:
            validated_data.pop("cover_letter_file", None)
        if mode == Application.CoverLetterMode.NONE:
            validated_data["cover_letter_text"] = ""
        return super().create(validated_data)
