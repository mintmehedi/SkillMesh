from rest_framework import serializers

from employers.models import JobCategory
from .models import CandidateProfile, CandidateSkill, ResumeDocument, WorkExperience


class CandidateSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateSkill
        fields = ("id", "skill_name", "level")


class WorkExperienceSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        is_current = attrs.get("is_current", False)
        end_date = attrs.get("end_date")
        start_date = attrs.get("start_date")
        if is_current:
            attrs["end_date"] = None
        if (not is_current) and start_date and end_date and end_date < start_date:
            raise serializers.ValidationError("End date cannot be before start date.")
        return attrs

    class Meta:
        model = WorkExperience
        fields = (
            "id",
            "job_title",
            "company_name",
            "start_date",
            "end_date",
            "is_current",
            "description",
            "sort_order",
        )
        read_only_fields = ("id",)


class JobCategoryBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobCategory
        fields = ("id", "slug", "name")


class CandidateProfileSerializer(serializers.ModelSerializer):
    skills = CandidateSkillSerializer(many=True, required=False)
    work_experiences = WorkExperienceSerializer(many=True, read_only=True)
    preferred_job_categories = JobCategoryBriefSerializer(many=True, read_only=True)
    preferred_job_category_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = CandidateProfile
        fields = (
            "id",
            "user",
            "full_name",
            "contact",
            "date_of_birth",
            "postcode",
            "country",
            "mobile_number",
            "education_level",
            "major",
            "years_experience",
            "location",
            "preferred_mode",
            "summary",
            "onboarding_step",
            "skills",
            "work_experiences",
            "preferred_job_categories",
            "preferred_job_category_ids",
        )
        read_only_fields = ("user",)

    def create(self, validated_data):
        skills = validated_data.pop("skills", [])
        category_ids = validated_data.pop("preferred_job_category_ids", None)
        profile = CandidateProfile.objects.create(**validated_data)
        for skill in skills:
            CandidateSkill.objects.create(candidate=profile, **skill)
        if category_ids is not None:
            profile.preferred_job_categories.set(category_ids)
        return profile

    def update(self, instance, validated_data):
        skills = validated_data.pop("skills", None)
        category_ids = validated_data.pop("preferred_job_category_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if skills is not None:
            instance.skills.all().delete()
            for skill in skills:
                CandidateSkill.objects.create(candidate=instance, **skill)
        if category_ids is not None:
            instance.preferred_job_categories.set(category_ids)
        return instance


class ResumeUploadSerializer(serializers.ModelSerializer):
    ALLOWED_EXTENSIONS = (".pdf", ".docx", ".jpg", ".jpeg", ".png")

    def validate_file(self, value):
        name = (value.name or "").lower()
        if not name.endswith(self.ALLOWED_EXTENSIONS):
            raise serializers.ValidationError("Only PDF, DOCX, JPG, JPEG, and PNG files are supported.")
        return value

    class Meta:
        model = ResumeDocument
        fields = ("id", "file", "raw_text", "parsed_json", "parsed_at", "created_at")
        read_only_fields = ("raw_text", "parsed_json", "parsed_at", "created_at")
