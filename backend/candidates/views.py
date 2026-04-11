import logging
import mimetypes
from pathlib import Path

from django.db import transaction
from django.http import FileResponse, Http404
from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCandidate
from employers.models import JobCategory, JobSkill
from employers.serializers import JobCategorySerializer

from .models import CandidateEducation, CandidateProfile, CandidateSkill, ResumeDocument, WorkExperience
from .resume_llm import apply_llm_work_experiences_if_configured
from .resume_parser import extract_text_from_upload, parse_resume_text
from .serializers import (
    CandidateEducationSerializer,
    CandidateProfileSerializer,
    ResumeDisplayNameSerializer,
    ResumeDocumentBriefSerializer,
    ResumeUploadSerializer,
    WorkExperienceSerializer,
)
from .skill_suggestions import suggest_skill_names

logger = logging.getLogger(__name__)


def _serialize_candidate_profile(profile: CandidateProfile) -> dict:
    fresh = (
        CandidateProfile.objects.prefetch_related(
            "skills",
            "work_experiences",
            "education_entries",
            "preferred_job_categories",
        ).get(pk=profile.pk)
    )
    return CandidateProfileSerializer(fresh).data


class CandidateProfileBundleView(APIView):
    """
    Single endpoint: optional profile patch + replace education + replace work (one transaction).
    Omit \"profile\" to leave profile row unchanged (e.g. onboarding save). Same datasets as
    /education/ and /work-experience/ bulk PUTs.
    """

    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def get(self, request):
        profile = CandidateProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({}, status=status.HTTP_200_OK)
        return Response(_serialize_candidate_profile(profile))

    def put(self, request):
        profile, _ = CandidateProfile.objects.get_or_create(
            user=request.user,
            defaults={"full_name": request.user.get_full_name() or request.user.email},
        )
        body = request.data
        advanced_onboarding = False

        with transaction.atomic():
            if "profile" in body and body["profile"] is not None:
                ser = CandidateProfileSerializer(profile, data=body["profile"], partial=True)
                ser.is_valid(raise_exception=True)
                ser.save()

            if "education_entries" in body and body["education_entries"] is not None:
                edu_ser = CandidateEducationSerializer(data=body["education_entries"], many=True)
                edu_ser.is_valid(raise_exception=True)
                profile.education_entries.all().delete()
                for row in edu_ser.validated_data:
                    CandidateEducation.objects.create(candidate=profile, **row)

            if "work_experiences" in body and body["work_experiences"] is not None:
                work_ser = WorkExperienceSerializer(data=body["work_experiences"], many=True)
                work_ser.is_valid(raise_exception=True)
                profile.work_experiences.all().delete()
                for row in work_ser.validated_data:
                    WorkExperience.objects.create(candidate=profile, **row)
                if profile.onboarding_step == CandidateProfile.OnboardingStep.RESUME:
                    profile.onboarding_step = CandidateProfile.OnboardingStep.CATEGORIES
                    profile.save(update_fields=["onboarding_step"])
                    advanced_onboarding = True

        out = dict(_serialize_candidate_profile(profile))
        if advanced_onboarding:
            out["next_step"] = CandidateProfile.OnboardingStep.CATEGORIES
            out["next_route"] = "/onboarding/categories"
        return Response(out, status=status.HTTP_200_OK)


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
        location = self.request.query_params.get("location")

        if skill:
            qs = qs.filter(skills__skill_name__icontains=skill)
        if education:
            qs = qs.filter(education_level__icontains=education)
        if location:
            qs = qs.filter(location__icontains=location)
        return qs.distinct().order_by("-id")


class JobCategoryListView(generics.ListAPIView):
    queryset = JobCategory.objects.all()
    serializer_class = JobCategorySerializer
    permission_classes = [permissions.AllowAny]


class EducationBulkView(APIView):
    """Bulk replace education entries; does not advance onboarding (work-experience PUT does)."""

    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def get(self, request):
        profile = CandidateProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response([])
        data = CandidateEducationSerializer(profile.education_entries.all(), many=True)
        return Response(data.data)

    def put(self, request):
        profile, _ = CandidateProfile.objects.get_or_create(
            user=request.user,
            defaults={"full_name": request.user.get_full_name() or request.user.email},
        )
        serializer = CandidateEducationSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        profile.education_entries.all().delete()
        for row in serializer.validated_data:
            CandidateEducation.objects.create(candidate=profile, **row)
        return Response(
            {
                "education_entries": CandidateEducationSerializer(
                    profile.education_entries.all(), many=True
                ).data,
            },
            status=status.HTTP_200_OK,
        )


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


class SkillSuggestView(APIView):
    """Autocomplete for any signed-in user (candidates + employers posting jobs)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        from_jobs = list(
            JobSkill.objects.filter(skill_name__icontains=q)
            .values_list("skill_name", flat=True)
            .distinct()[:40]
        )
        from_candidates = list(
            CandidateSkill.objects.filter(skill_name__icontains=q)
            .values_list("skill_name", flat=True)
            .distinct()[:40]
        )
        names = suggest_skill_names(q, from_jobs=from_jobs, from_candidates=from_candidates, limit=12)
        return Response([{"skill_name": n} for n in names])


class ResumeListView(generics.ListAPIView):
    serializer_class = ResumeDocumentBriefSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def get_queryset(self):
        return ResumeDocument.objects.filter(candidate__user=self.request.user).order_by("-created_at")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class ResumeDownloadView(APIView):
    """Serve resume file with JWT auth (new tab / Open link cannot send Bearer on plain href)."""

    permission_classes = [permissions.IsAuthenticated, IsCandidate]
    http_method_names = ["get", "head", "options"]

    def get(self, request, pk):
        resume = ResumeDocument.objects.filter(pk=pk, candidate__user=request.user).first()
        if not resume or not resume.file:
            raise Http404()
        fh = resume.file.open("rb")
        name = resume.file.name
        content_type, _ = mimetypes.guess_type(name)
        if not content_type:
            content_type = "application/octet-stream"
        basename = name.rsplit("/", 1)[-1] if name else "resume"
        resp = FileResponse(fh, content_type=content_type)
        resp["Content-Disposition"] = f'inline; filename="{basename}"'
        return resp


class ResumeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return ResumeDocument.objects.filter(candidate__user=self.request.user)

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return ResumeDisplayNameSerializer
        return ResumeDocumentBriefSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class ResumeUploadView(generics.GenericAPIView):
    serializer_class = ResumeUploadSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request):
        profile, _ = CandidateProfile.objects.get_or_create(
            user=request.user, defaults={"full_name": request.user.username or request.user.email}
        )
        prior_onboarding_step = profile.onboarding_step
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        display_name = (serializer.validated_data.get("display_name") or "").strip()
        if not display_name:
            display_name = (Path(uploaded.name).stem or "Resume")[:255]
        resume = ResumeDocument.objects.create(
            candidate=profile,
            file=uploaded,
            display_name=display_name,
        )
        try:
            resume.file.open("rb")
            raw_text = extract_text_from_upload(resume.file)
            parsed = parse_resume_text(raw_text)
            try:
                parsed = apply_llm_work_experiences_if_configured(parsed, raw_text)
            except Exception:
                logger.exception("resume LLM merge failed; using heuristic parse only")
            resume.raw_text = raw_text
            resume.parsed_json = parsed
            resume.parsed_at = parse_datetime(parsed["parsed_at"])
            resume.save()
        except Exception as exc:
            resume.delete()
            return Response(
                {"detail": f"Could not parse resume file. {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.education_level = profile.education_level or parsed.get("education_level", "")
        studies = parsed.get("studies") or []
        if isinstance(studies, list) and studies:
            first = studies[0] if isinstance(studies[0], dict) else None
            if first:
                if not (profile.education_level or "").strip():
                    deg = str(first.get("degree") or "").strip()
                    if deg:
                        profile.education_level = deg[:120]
                if not (profile.major or "").strip():
                    maj = str(first.get("major") or first.get("field_of_study") or "").strip()
                    if maj:
                        profile.major = maj[:120]
        profile.onboarding_step = CandidateProfile.OnboardingStep.RESUME
        profile.save()
        for skill in parsed.get("skills", []):
            CandidateSkill.objects.get_or_create(candidate=profile, skill_name=skill, defaults={"level": 1})

        if prior_onboarding_step == CandidateProfile.OnboardingStep.RESUME:
            ResumeDocument.objects.filter(candidate=profile).exclude(pk=resume.pk).delete()

        return Response(ResumeUploadSerializer(resume).data, status=status.HTTP_201_CREATED)


class ResumeReprocessView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request, resume_id):
        resume = ResumeDocument.objects.filter(id=resume_id, candidate__user=request.user).first()
        if not resume:
            return Response({"detail": "Resume not found"}, status=status.HTTP_404_NOT_FOUND)
        raw_text = extract_text_from_upload(resume.file)
        parsed = parse_resume_text(raw_text)
        try:
            parsed = apply_llm_work_experiences_if_configured(parsed, raw_text)
        except Exception:
            logger.exception("resume LLM merge failed; using heuristic parse only")
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
