from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import generics, permissions
from rest_framework.response import Response

from accounts.permissions import IsEmployer
from .models import CompanyProfile, JobPosting
from .serializers import CompanyProfileSerializer, JobPostingPublicSerializer, JobPostingSerializer
from .utils_workspace import workspace_owner


class CompanyProfileUpsertView(generics.GenericAPIView):
    serializer_class = CompanyProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get(self, request):
        owner = workspace_owner(request.user)
        profile = CompanyProfile.objects.filter(user=owner).first()
        if not profile:
            return Response({})
        return Response(self.get_serializer(profile).data)

    def post(self, request):
        owner = workspace_owner(request.user)
        profile = CompanyProfile.objects.filter(user=owner).first()
        is_initial = profile is None
        if profile:
            serializer = self.get_serializer(profile, data=request.data, partial=True)
        else:
            serializer = self.get_serializer(data=request.data)
        serializer.context["is_initial_company_setup"] = is_initial
        serializer.is_valid(raise_exception=True)
        serializer.save(user=owner)
        return Response(serializer.data)


class EmployerJobListCreateView(generics.ListCreateAPIView):
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        owner = workspace_owner(self.request.user)
        return JobPosting.objects.filter(employer=owner).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(employer=workspace_owner(self.request.user))


class EmployerJobDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        return JobPosting.objects.filter(employer=workspace_owner(self.request.user))


class JobListView(generics.ListAPIView):
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return JobPosting.objects.public_live().select_related("job_category", "employer").prefetch_related("skills").order_by(
            "-created_at"
        )


class JobSearchView(generics.ListAPIView):
    """Keyword search over open jobs; public (same access model as feed)."""

    serializer_class = JobPostingPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            JobPosting.objects.public_live()
            .select_related("job_category", "employer")
            .prefetch_related("skills")
        )
        keyword = (self.request.query_params.get("keyword") or "").strip()
        if keyword:
            qs = qs.filter(Q(jd_text__icontains=keyword) | Q(title__icontains=keyword))
        return qs.order_by("-created_at")


class JobPublicDetailView(generics.RetrieveAPIView):
    """Single open job for shareable URLs and full-page candidate view."""

    serializer_class = JobPostingPublicSerializer
    permission_classes = [permissions.AllowAny]
    queryset = JobPosting.objects.public_live().select_related("job_category", "employer").prefetch_related("skills")
    lookup_field = "pk"


class JobFeedView(generics.ListAPIView):
    """
    Homepage job list: open jobs, newest first.
    If logged-in candidate has preferred categories, matching jobs are listed first.
    """

    serializer_class = JobPostingPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            JobPosting.objects.public_live()
            .select_related("job_category", "employer")
            .prefetch_related("skills")
            .order_by("-created_at")
        )
        user = self.request.user
        if (
            user.is_authenticated
            and getattr(user, "role", None) == "candidate"
        ):
            profile = getattr(user, "candidate_profile", None)
            if profile and profile.preferred_job_categories.exists():
                pref_ids = list(profile.preferred_job_categories.values_list("id", flat=True))
                qs = qs.annotate(
                    _pref_order=Case(
                        When(job_category_id__in=pref_ids, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                ).order_by("_pref_order", "-created_at")
        return qs
