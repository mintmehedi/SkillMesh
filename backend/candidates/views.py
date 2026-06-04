import logging
import mimetypes
from pathlib import Path

from django.db import transaction
from django.http import FileResponse, Http404
from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCandidate, IsEmployer
from accounts.membership import is_premium_candidate
from employers.models import JobCategory, JobSkill
from employers.serializers import JobCategorySerializer

from .models import CandidateEducation, CandidateProfile, CandidateSavedSearch, CandidateSkill, ResumeDocument, WorkExperience
from .resume_llm import apply_llm_work_experiences_if_configured
from .resume_parser import extract_text_from_upload, parse_resume_text
from .serializers import (
    CandidateEducationSerializer,
    CandidateProfileSerializer,
    CandidateSearchResultSerializer,
    ResumeDisplayNameSerializer,
    ResumeDocumentBriefSerializer,
    ResumeUploadSerializer,
    CandidateSavedSearchSerializer,
    WorkExperienceSerializer,
)
from .candidate_search import employer_candidate_search_queryset, filter_candidate_queryset
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
        try:
            return self._put_bundle(request)
        except Exception:
            logger.exception("candidate profile bundle PUT failed")
            return Response(
                {"detail": "Could not save education and work experience. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _put_bundle(self, request):
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
                if not edu_ser.is_valid():
                    return Response(
                        {"education_entries": edu_ser.errors},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                profile.education_entries.all().delete()
                for row in edu_ser.validated_data:
                    CandidateEducation.objects.create(candidate=profile, **row)

            if "work_experiences" in body and body["work_experiences"] is not None:
                work_ser = WorkExperienceSerializer(data=body["work_experiences"], many=True)
                if not work_ser.is_valid():
                    return Response(
                        {"work_experiences": work_ser.errors},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
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
    serializer_class = CandidateSearchResultSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        return employer_candidate_search_queryset().order_by("-id")


class CandidateSearchView(generics.ListAPIView):
    """Keyword and optional skill/education/location/category/mode filters over candidate profiles."""

    serializer_class = CandidateSearchResultSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        qs = employer_candidate_search_queryset()
        return filter_candidate_queryset(qs, self.request)


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
        qs = ResumeDocument.objects.filter(candidate__user=self.request.user).order_by("-created_at")
        if not is_premium_candidate(self.request.user):
            return qs[:1]
        return qs

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
        premium_user = is_premium_candidate(request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        display_name = (serializer.validated_data.get("display_name") or "").strip()
        if not display_name:
            display_name = (Path(uploaded.name).stem or "Resume")[:255]
        try:
            resume = ResumeDocument.objects.create(
                candidate=profile,
                file=uploaded,
                display_name=display_name,
            )
        except OSError:
            logger.exception("resume file storage failed")
            return Response(
                {
                    "detail": (
                        "Could not store the resume file on the server. "
                        "You can still enter education and work experience manually."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
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

        if not premium_user:
            ResumeDocument.objects.filter(candidate=profile).exclude(pk=resume.pk).delete()

        return Response(ResumeUploadSerializer(resume).data, status=status.HTTP_201_CREATED)


class CandidateSavedSearchListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]
    serializer_class = CandidateSavedSearchSerializer

    def get_queryset(self):
        profile = CandidateProfile.objects.filter(user=self.request.user).first()
        if not profile:
            return CandidateSavedSearch.objects.none()
        return CandidateSavedSearch.objects.filter(candidate=profile)

    def _require_premium(self):
        if not is_premium_candidate(self.request.user):
            return Response(
                {"detail": "Saved searches are available to premium members only.", "upgrade_cta": True},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        return None

    def list(self, request, *args, **kwargs):
        blocked = self._require_premium()
        if blocked:
            return blocked
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        blocked = self._require_premium()
        if blocked:
            return blocked
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        profile, _ = CandidateProfile.objects.get_or_create(
            user=self.request.user,
            defaults={"full_name": self.request.user.get_full_name() or self.request.user.email},
        )
        serializer.save(candidate=profile)


class CandidateSavedSearchDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]
    serializer_class = CandidateSavedSearchSerializer

    def get_queryset(self):
        profile = CandidateProfile.objects.filter(user=self.request.user).first()
        if not profile:
            return CandidateSavedSearch.objects.none()
        return CandidateSavedSearch.objects.filter(candidate=profile)

    def _premium_blocked(self, request):
        if not is_premium_candidate(request.user):
            return Response(
                {"detail": "Saved searches are available to premium members only.", "upgrade_cta": True},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        return None

    def retrieve(self, request, *args, **kwargs):
        blocked = self._premium_blocked(request)
        if blocked:
            return blocked
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        blocked = self._premium_blocked(request)
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._premium_blocked(request)
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)


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
