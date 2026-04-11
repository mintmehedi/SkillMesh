import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from candidates.models import CandidateProfile
from employers.models import CompanyProfile, EmployerTeamInvite
from employers.utils_workspace import workspace_owner


User = get_user_model()

_PASSWORD_SPECIAL_RE = re.compile(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]')
_AU_POSTCODE_RE = re.compile(r"^\d{4}$")
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")


def username_validation_reason(username):
    value = (username or "").strip()
    if not _USERNAME_RE.match(value):
        return "invalid_format"
    if User.objects.filter(username__iexact=value).exists():
        return "taken"
    return None


class RegisterSerializer(serializers.ModelSerializer):
    """Employer registration only (`/api/auth/register`)."""

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    employer_invite_token = serializers.UUIDField(required=False, write_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ("id", "email", "username", "password", "password_confirm", "role", "employer_invite_token")
        extra_kwargs = {
            # Custom validate_email / validate_username provide role-aware messages.
            "email": {"validators": []},
            "username": {"validators": []},
        }

    def validate_role(self, value):
        if value != User.Role.EMPLOYER:
            raise serializers.ValidationError("This endpoint is only for employer registration.")
        return value

    def validate_email(self, value):
        email = value.strip().lower()
        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            if existing.role == User.Role.CANDIDATE:
                raise serializers.ValidationError(
                    "A candidate account already uses this email. Please sign in as a candidate or use a different email."
                )
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_username(self, value):
        normalized = value.strip()
        if not _USERNAME_RE.match(normalized):
            raise serializers.ValidationError(
                "Username must be 3-20 characters and contain only letters, numbers, and underscores."
            )
        existing = User.objects.filter(username__iexact=normalized).first()
        if existing:
            if existing.role == User.Role.CANDIDATE:
                raise serializers.ValidationError(
                    "This username is registered as a candidate. Please sign in as a candidate or choose a different username."
                )
            raise serializers.ValidationError("This username is already taken.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        if not _PASSWORD_SPECIAL_RE.search(value):
            raise serializers.ValidationError(
                "Password must contain at least one special character (!@#$%^&* etc.)."
            )
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        self._employer_invite = None
        invite_token = attrs.pop("employer_invite_token", None)
        if invite_token is not None:
            invite = (
                EmployerTeamInvite.objects.filter(token=invite_token, accepted_at__isnull=True)
                .select_related("organization_owner")
                .first()
            )
            if not invite:
                raise serializers.ValidationError({"employer_invite_token": "Invalid or expired invite."})
            email = attrs["email"].strip().lower()
            if email != invite.email.strip().lower():
                raise serializers.ValidationError({"email": "Use the email address this invitation was sent to."})
            root = workspace_owner(invite.organization_owner)
            prof = CompanyProfile.objects.filter(user=root).first()
            if not prof or not prof.profile_completed:
                raise serializers.ValidationError({"employer_invite_token": "This invitation is no longer valid."})
            self._employer_invite = invite
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        validated_data.pop("role", None)
        validated_data.pop("employer_invite_token", None)
        user = User(
            email=validated_data["email"],
            username=validated_data["username"],
            role=User.Role.EMPLOYER,
        )
        user.set_password(password)
        user.save()
        invite = getattr(self, "_employer_invite", None)
        if invite:
            user.employer_organization_owner = workspace_owner(invite.organization_owner)
            user.save(update_fields=["employer_organization_owner"])
            invite.accepted_at = timezone.now()
            invite.save(update_fields=["accepted_at"])
        return user


class CandidateRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(min_length=3, max_length=20)

    def validate_email(self, value):
        email = value.strip().lower()
        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            if existing.role == User.Role.EMPLOYER:
                raise serializers.ValidationError(
                    "An employer account already uses this email. Please sign in as an employer or use a different email."
                )
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    date_of_birth = serializers.DateField()
    postcode = serializers.CharField(max_length=20)
    suburb = serializers.CharField(max_length=120)
    country = serializers.CharField(max_length=120)
    mobile_number = serializers.CharField(max_length=32)

    def validate_password(self, value):
        validate_password(value)
        if not _PASSWORD_SPECIAL_RE.search(value):
            raise serializers.ValidationError(
                "Password must contain at least one special character (!@#$%^&* etc.)."
            )
        return value

    def validate_username(self, value):
        normalized = value.strip()
        reason = username_validation_reason(normalized)
        if reason == "invalid_format":
            raise serializers.ValidationError(
                "Username must be 3-20 characters and contain only letters, numbers, and underscores."
            )
        if reason == "taken":
            existing = User.objects.filter(username__iexact=normalized).first()
            if existing and existing.role == User.Role.EMPLOYER:
                raise serializers.ValidationError(
                    "This username is registered as an employer. Please sign in as an employer or choose a different username."
                )
            raise serializers.ValidationError("This username is already taken.")
        return normalized

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        if not _AU_POSTCODE_RE.match(attrs["postcode"].strip()):
            raise serializers.ValidationError({"postcode": "Enter a valid 4-digit Australian postcode."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        email = validated_data.pop("email")
        username = validated_data.pop("username")
        first_name = validated_data.pop("first_name")
        last_name = validated_data.pop("last_name")
        date_of_birth = validated_data.pop("date_of_birth")
        postcode = validated_data.pop("postcode")
        suburb = validated_data.pop("suburb")
        country = validated_data.pop("country")
        mobile_number = validated_data.pop("mobile_number")

        user = User(
            email=email,
            username=username,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.CANDIDATE,
        )
        user.set_password(password)
        user.save()

        full_name = f"{first_name} {last_name}".strip()
        CandidateProfile.objects.create(
            user=user,
            full_name=full_name,
            date_of_birth=date_of_birth,
            postcode=postcode,
            country=country,
            mobile_number=mobile_number,
            contact=mobile_number,
            location=suburb,
            onboarding_step=CandidateProfile.OnboardingStep.RESUME,
        )
        return user


class MeSerializer(serializers.ModelSerializer):
    candidate_onboarding = serializers.SerializerMethodField()
    employer_company = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "role",
            "first_name",
            "last_name",
            "candidate_onboarding",
            "employer_company",
        )

    def get_candidate_onboarding(self, obj):
        if obj.role != User.Role.CANDIDATE:
            return None
        profile = getattr(obj, "candidate_profile", None)
        if not profile:
            return None
        return {
            "onboarding_step": profile.onboarding_step,
            "has_resume": profile.resumes.exists(),
            "preferred_categories_count": profile.preferred_job_categories.count(),
        }

    def get_employer_company(self, obj):
        if obj.role != User.Role.EMPLOYER:
            return None
        owner = workspace_owner(obj)
        row = CompanyProfile.objects.filter(user=owner).first()
        is_member = obj.employer_organization_owner_id is not None
        if not row:
            return {
                "needs_company_profile": True,
                "profile_completed": False,
                "is_team_member": is_member,
            }
        return {
            "needs_company_profile": not row.profile_completed,
            "profile_completed": row.profile_completed,
            "is_team_member": is_member,
            "workspace_company_name": row.company_name if is_member else None,
        }


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"
