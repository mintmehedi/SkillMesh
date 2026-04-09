from rest_framework import serializers

from .models import CompanyProfile, JobCategory, JobPosting, JobSkill


class JobCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = JobCategory
        fields = ("id", "slug", "name", "sort_order")


class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = ("id", "company_name", "description", "website", "location")


class JobSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobSkill
        fields = ("id", "skill_name", "weight")


class JobPostingSerializer(serializers.ModelSerializer):
    skills = JobSkillSerializer(many=True, required=False)
    job_category = JobCategorySerializer(read_only=True)
    job_category_id = serializers.PrimaryKeyRelatedField(
        queryset=JobCategory.objects.all(),
        source="job_category",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = JobPosting
        fields = (
            "id",
            "employer",
            "job_category",
            "job_category_id",
            "title",
            "company_info",
            "jd_text",
            "required_education",
            "required_experience",
            "work_mode",
            "location",
            "status",
            "created_at",
            "skills",
        )
        read_only_fields = ("employer", "created_at")

    def create(self, validated_data):
        skills = validated_data.pop("skills", [])
        job = JobPosting.objects.create(**validated_data)
        for skill in skills:
            JobSkill.objects.create(job=job, **skill)
        return job

    def update(self, instance, validated_data):
        skills = validated_data.pop("skills", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if skills is not None:
            instance.skills.all().delete()
            for skill in skills:
                JobSkill.objects.create(job=instance, **skill)
        return instance
