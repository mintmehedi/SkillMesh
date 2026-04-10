from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCandidate
from employers.models import JobCategory
from employers.serializers import JobCategorySerializer

from .models import CandidateProfile, CandidateSkill, ResumeDocument, WorkExperience
from .resume_parser import extract_text_from_upload, parse_resume_text
from .serializers import (
    CandidateProfileSerializer,
    ResumeUploadSerializer,
    WorkExperienceSerializer,
)


class CandidateProfileUpsertView(generics.GenericAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def get(self, request):
        profile = CandidateProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({}, status=status.HTTP_200_OK)
        return Response(self.get_serializer(profile).data)

    def post(self, request):
        return self._save(request, partial=False)

    def patch(self, request):
        return self._save(request, partial=True)

    def _save(self, request, partial):
        profile = CandidateProfile.objects.filter(user=request.user).first()
        if profile:
            serializer = self.get_serializer(profile, data=request.data, partial=partial)
        else:
            serializer = self.get_serializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CandidateListView(generics.ListAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = CandidateProfile.objects.all().order_by("-id")


class CandidateSearchView(generics.ListAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = CandidateProfile.objects.all()
        skill = self.request.query_params.get("skills")
        education = self.request.query_params.get("education")
        experience_min = self.request.query_params.get("experience_min")
        location = self.request.query_params.get("location")

        if skill:
            qs = qs.filter(skills__skill_name__icontains=skill)
        if education:
            qs = qs.filter(education_level__icontains=education)
        if experience_min:
            try:
                qs = qs.filter(years_experience__gte=int(experience_min))
            except ValueError:
                pass
        if location:
            qs = qs.filter(location__icontains=location)
        return qs.distinct().order_by("-id")


class JobCategoryListView(generics.ListAPIView):
    queryset = JobCategory.objects.all()
    serializer_class = JobCategorySerializer
    permission_classes = [permissions.AllowAny]


class WorkExperienceBulkView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def get(self, request):
        profile = CandidateProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response([])
        data = WorkExperienceSerializer(profile.work_experiences.all(), many=True)
        return Response(data.data)

    def put(self, request):
        profile, _ = CandidateProfile.objects.get_or_create(
            user=request.user,
            defaults={"full_name": request.user.get_full_name() or request.user.email},
        )
        serializer = WorkExperienceSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        profile.work_experiences.all().delete()
        for row in serializer.validated_data:
            WorkExperience.objects.create(candidate=profile, **row)
        if profile.onboarding_step == CandidateProfile.OnboardingStep.RESUME:
            profile.onboarding_step = CandidateProfile.OnboardingStep.CATEGORIES
            profile.save(update_fields=["onboarding_step"])
        return Response(
            {
                "work_experiences": WorkExperienceSerializer(profile.work_experiences.all(), many=True).data,
                "next_step": CandidateProfile.OnboardingStep.CATEGORIES,
                "next_route": "/onboarding/categories",
            },
            status=status.HTTP_200_OK,
        )


class ResumeUploadView(generics.GenericAPIView):
    serializer_class = ResumeUploadSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request):
        profile, _ = CandidateProfile.objects.get_or_create(
            user=request.user, defaults={"full_name": request.user.username or request.user.email}
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        resume = ResumeDocument.objects.create(candidate=profile, file=uploaded)
        try:
            resume.file.open("rb")
            raw_text = extract_text_from_upload(resume.file)
        except Exception as exc:
            return Response(
                {"detail": f"Could not parse resume file. {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        parsed = parse_resume_text(raw_text)
        resume.raw_text = raw_text
        resume.parsed_json = parsed
        resume.parsed_at = parse_datetime(parsed["parsed_at"])
        resume.save()

        profile.education_level = profile.education_level or parsed.get("education_level", "")
        profile.years_experience = max(profile.years_experience, parsed.get("years_experience", 0))
        profile.onboarding_step = CandidateProfile.OnboardingStep.RESUME
        profile.save()
        for skill in parsed.get("skills", []):
            CandidateSkill.objects.get_or_create(candidate=profile, skill_name=skill, defaults={"level": 1})

        return Response(ResumeUploadSerializer(resume).data, status=status.HTTP_201_CREATED)


class ResumeReprocessView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request, resume_id):
        resume = ResumeDocument.objects.filter(id=resume_id, candidate__user=request.user).first()
        if not resume:
            return Response({"detail": "Resume not found"}, status=status.HTTP_404_NOT_FOUND)
        raw_text = extract_text_from_upload(resume.file)
        parsed = parse_resume_text(raw_text)
        resume.raw_text = raw_text
        resume.parsed_json = parsed
        resume.parsed_at = parse_datetime(parsed["parsed_at"])
        resume.save()
        return Response(ResumeUploadSerializer(resume).data)


class CandidateOnboardingAdvanceView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request):
        action = (request.data.get("action") or "").strip()
        profile, _ = CandidateProfile.objects.get_or_create(
            user=request.user,
            defaults={"full_name": request.user.get_full_name() or request.user.email},
        )
        if action not in {"skip_resume_experience", "complete_resume_experience", "complete_categories"}:
            return Response({"detail": "Unsupported action."}, status=status.HTTP_400_BAD_REQUEST)

        if action in {"skip_resume_experience", "complete_resume_experience"}:
            profile.onboarding_step = CandidateProfile.OnboardingStep.CATEGORIES
            profile.save(update_fields=["onboarding_step"])
            return Response(
                {
                    "onboarding_step": profile.onboarding_step,
                    "next_route": "/onboarding/categories",
                },
                status=status.HTTP_200_OK,
            )

        profile.onboarding_step = CandidateProfile.OnboardingStep.DONE
        profile.save(update_fields=["onboarding_step"])
        return Response(
            {
                "onboarding_step": profile.onboarding_step,
                "next_route": "/candidate",
            },
            status=status.HTTP_200_OK,
        )
