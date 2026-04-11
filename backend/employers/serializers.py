from datetime import date
from decimal import Decimal

from rest_framework import serializers

from .models import CompanyProfile, EmployerTeamInvite, JobCategory, JobPosting, JobSkill


def clean_job_bullet_lines(value, *, max_items: int = 30, max_len: int = 500) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError("Must be a list of text lines.")
    cleaned: list[str] = []
    for item in value[:max_items]:
        s = str(item).strip()
        if len(s) > max_len:
            raise serializers.ValidationError(f"Each line must be at most {max_len} characters.")
        if s:
            cleaned.append(s)
    return cleaned


class JobCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = JobCategory
        fields = ("id", "slug", "name", "sort_order")


class CompanyProfileSerializer(serializers.ModelSerializer):
    """Full employer company profile; initial create requires complete data (see validate)."""

    profile_completed = serializers.BooleanField(read_only=True)
    website = serializers.URLField(allow_blank=True, required=False, max_length=200)
    linkedin_url = serializers.URLField(allow_blank=True, required=False, max_length=200)

    class Meta:
        model = CompanyProfile
        fields = (
            "id",
            "profile_completed",
            "company_name",
            "description",
            "website",
            "location",
            "industry",
            "company_size",
            "founded_year",
            "phone",
            "contact_email",
            "country",
            "country_code",
            "state_region",
            "city",
            "suburb",
            "street_address",
            "postcode",
            "business_registration_number",
            "linkedin_url",
        )

    def validate_founded_year(self, value):
        if value is None:
            return value
        y = int(value)
        current = date.today().year
        if y < 1800 or y > current:
            raise serializers.ValidationError(f"Enter a year between 1800 and {current}.")
        return y

    def validate_country_code(self, value):
        v = (value or "").strip().upper()
        if not v:
            return ""
        if len(v) != 2 or not v.isalpha():
            raise serializers.ValidationError("Use a 2-letter country code or leave blank.")
        return v

    def validate_company_size(self, value):
        if not (value or "").strip():
            return ""
        allowed = {c[0] for c in CompanyProfile.CompanySize.choices}
        if value not in allowed:
            raise serializers.ValidationError("Select a valid company size.")
        return value

    def validate(self, attrs):
        if not self.context.get("is_initial_company_setup"):
            return attrs
        errors = {}
        name = (attrs.get("company_name") or "").strip()
        if not name:
            errors["company_name"] = "Company name is required."
        industry = (attrs.get("industry") or "").strip()
        if not industry:
            errors["industry"] = "Industry is required."
        size = (attrs.get("company_size") or "").strip()
        if not size:
            errors["company_size"] = "Company size is required."
        elif size not in {c[0] for c in CompanyProfile.CompanySize.choices}:
            errors["company_size"] = "Select a valid company size."
        desc = (attrs.get("description") or "").strip()
        if len(desc) < 20:
            errors["description"] = "Please write at least 20 characters about your company."
        country = (attrs.get("country") or "").strip()
        if not country:
            errors["country"] = "Country is required."
        city = (attrs.get("city") or "").strip()
        if not city:
            errors["city"] = "City or town is required."
        suburb = (attrs.get("suburb") or "").strip()
        if not suburb:
            errors["suburb"] = "Suburb or district is required."
        state = (attrs.get("state_region") or "").strip()
        if not state:
            errors["state_region"] = "State or region is required."
        phone = (attrs.get("phone") or "").strip()
        email = (attrs.get("contact_email") or "").strip()
        if not phone and not email:
            msg = "Provide a phone number and/or a company contact email."
            errors["phone"] = msg
            errors["contact_email"] = msg
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        inst = super().create(validated_data)
        if self.context.get("is_initial_company_setup"):
            inst.profile_completed = True
            inst.save(update_fields=["profile_completed"])
        return inst

    def update(self, instance, validated_data):
        inst = super().update(instance, validated_data)
        if self.context.get("is_initial_company_setup"):
            inst.profile_completed = True
            inst.save(update_fields=["profile_completed"])
        return inst


class JobSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobSkill
        fields = ("id", "skill_name", "weight")


class JobPostingPublicSerializer(serializers.ModelSerializer):
    """Read-only job payload for feed, search, and public detail (no employer user id)."""

    skills = JobSkillSerializer(many=True, read_only=True)
    job_category = JobCategorySerializer(read_only=True)

    class Meta:
        model = JobPosting
        fields = (
            "id",
            "job_category",
            "title",
            "company_info",
            "jd_text",
            "whats_on_offer",
            "looking_for_people_bullets",
            "looking_for_additional_bullets",
            "role_bullets",
            "why_choose_us_bullets",
            "how_to_apply",
            "required_education",
            "required_experience",
            "work_mode",
            "location",
            "licenses_certifications",
            "compensation_period",
            "compensation_amount_min",
            "compensation_amount_max",
            "closing_date",
            "created_at",
            "skills",
        )
        read_only_fields = fields


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
    whats_on_offer = serializers.ListField(
        child=serializers.CharField(max_length=500, allow_blank=True),
        required=False,
        allow_empty=True,
    )
    looking_for_people_bullets = serializers.ListField(
        child=serializers.CharField(max_length=500, allow_blank=True),
        required=False,
        allow_empty=True,
    )
    looking_for_additional_bullets = serializers.ListField(
        child=serializers.CharField(max_length=500, allow_blank=True),
        required=False,
        allow_empty=True,
    )
    role_bullets = serializers.ListField(
        child=serializers.CharField(max_length=500, allow_blank=True),
        required=False,
        allow_empty=True,
    )
    why_choose_us_bullets = serializers.ListField(
        child=serializers.CharField(max_length=500, allow_blank=True),
        required=False,
        allow_empty=True,
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
            "whats_on_offer",
            "looking_for_people_bullets",
            "looking_for_additional_bullets",
            "role_bullets",
            "why_choose_us_bullets",
            "how_to_apply",
            "required_education",
            "required_experience",
            "work_mode",
            "location",
            "status",
            "closing_date",
            "licenses_certifications",
            "compensation_period",
            "compensation_amount_min",
            "compensation_amount_max",
            "created_at",
            "skills",
        )
        read_only_fields = ("employer", "created_at")

    closing_date = serializers.DateField(required=False, allow_null=True)

    def validate_whats_on_offer(self, value):
        return clean_job_bullet_lines(value)

    def validate_looking_for_people_bullets(self, value):
        return clean_job_bullet_lines(value)

    def validate_looking_for_additional_bullets(self, value):
        return clean_job_bullet_lines(value)

    def validate_role_bullets(self, value):
        return clean_job_bullet_lines(value)

    def validate_why_choose_us_bullets(self, value):
        return clean_job_bullet_lines(value)

    def validate_status(self, value):
        v = (value or "").strip().lower()
        if v not in ("open", "closed", "draft"):
            raise serializers.ValidationError('Status must be "open", "closed", or "draft".')
        return v

    def validate_compensation_period(self, value):
        allowed = {c[0] for c in JobPosting.CompensationPeriod.choices}
        if value not in allowed:
            raise serializers.ValidationError("Select a valid compensation period.")
        return value

    def validate(self, attrs):
        inst = self.instance
        status = attrs.get("status")
        if status is None and inst is not None:
            status = inst.status
        status = (status or "open").strip().lower()

        title = attrs.get("title")
        if title is None and inst is not None:
            title = inst.title
        title = (title or "").strip()
        jd = attrs.get("jd_text")
        if jd is None and inst is not None:
            jd = inst.jd_text
        jd = (jd or "").strip()

        if status != "draft":
            errors = {}
            if not title:
                errors["title"] = "This field may not be blank."
            if not jd:
                errors["jd_text"] = "This field may not be blank."
            if errors:
                raise serializers.ValidationError(errors)

        lo = attrs.get("compensation_amount_min", getattr(inst, "compensation_amount_min", None) if inst else None)
        hi = attrs.get("compensation_amount_max", getattr(inst, "compensation_amount_max", None) if inst else None)
        if lo is not None and hi is not None:
            lo_d = lo if isinstance(lo, Decimal) else Decimal(str(lo))
            hi_d = hi if isinstance(hi, Decimal) else Decimal(str(hi))
            if lo_d > hi_d:
                raise serializers.ValidationError(
                    {"compensation_amount_max": "Maximum must be greater than or equal to minimum."}
                )
        return attrs

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


class EmployerTeamInviteReadSerializer(serializers.ModelSerializer):
    join_path = serializers.SerializerMethodField()

    class Meta:
        model = EmployerTeamInvite
        fields = ("id", "email", "token", "created_at", "accepted_at", "join_path")
        read_only_fields = fields

    def get_join_path(self, obj):
        return f"/register?role=employer&invite={obj.token}"


class EmployerTeamInviteCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()
