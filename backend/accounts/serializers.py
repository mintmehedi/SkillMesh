import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from candidates.models import CandidateProfile


User = get_user_model()

_PASSWORD_SPECIAL_RE = re.compile(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "email", "username", "password", "role")

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class CandidateRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    date_of_birth = serializers.DateField()
    postcode = serializers.CharField(max_length=20)
    country = serializers.CharField(max_length=120)
    mobile_number = serializers.CharField(max_length=32)

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
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        email = validated_data.pop("email")
        first_name = validated_data.pop("first_name")
        last_name = validated_data.pop("last_name")
        date_of_birth = validated_data.pop("date_of_birth")
        postcode = validated_data.pop("postcode")
        country = validated_data.pop("country")
        mobile_number = validated_data.pop("mobile_number")

        username_base = email.split("@")[0][:30] or "user"
        username = username_base
        n = 0
        while User.objects.filter(username=username).exists():
            n += 1
            username = f"{username_base}{n}"[:150]

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
            onboarding_step=CandidateProfile.OnboardingStep.RESUME,
        )
        return user


class MeSerializer(serializers.ModelSerializer):
    candidate_onboarding = serializers.SerializerMethodField()

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


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"
