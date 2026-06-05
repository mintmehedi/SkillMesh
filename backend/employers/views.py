from django.db.models import Case, IntegerField, Q, TextField, Value, When
from django.db.models.functions import Cast
from rest_framework import generics, permissions
from rest_framework.response import Response

from accounts.permissions import IsEmployer
from core.search_fuzzy import apply_keyword_filter, fuzzy_search_enabled, maybe_fuzzy_rank_annotation
from .models import CompanyProfile, JobPosting

_JOB_FUZZY_FIELDS = (
    "title",
    "jd_text",
    "location",
    "company_info",
    "how_to_apply",
    "licenses_certifications",
    "job_category__name",
    "skills__skill_name",
    "employer__company_profile__location",
    "employer__company_profile__suburb",
    "employer__company_profile__city",
    "employer__company_profile__postcode",
    "employer__company_profile__state_region",
)


def _job_token_q(tok: str) -> Q:
    return (
        Q(title__icontains=tok)
        | Q(skills__skill_name__icontains=tok)
        | Q(job_category__name__icontains=tok)
        | Q(jd_text__icontains=tok)
        | Q(company_info__icontains=tok)
    )


def _job_location_token_q(term: str) -> Q:
    """
    Match a location token against the job listing first.
    Employer office fields are used only when the job has no location line, so a
    Brisbane listing is not pulled in by a Melbourne HQ address.
    """
    t = (term or "").strip()
    posted = (
        Q(location__icontains=t)
        | Q(jd_text__icontains=t)
        | Q(company_info__icontains=t)
        | Q(how_to_apply__icontains=t)
    )
    employer_geo = (
        Q(employer__company_profile__city__icontains=t)
        | Q(employer__company_profile__suburb__icontains=t)
        | Q(employer__company_profile__state_region__icontains=t)
        | Q(employer__company_profile__location__icontains=t)
        | Q(employer__company_profile__postcode__icontains=t)
        | Q(employer__company_profile__country__icontains=t)
    )
    no_job_location = Q(location__exact="") | Q(location__isnull=True)
    return posted | (no_job_location & employer_geo)
from .serializers import (
    CompanyProfileSerializer,
    EmployerJobListSerializer,
    JobPostingPublicSerializer,
    JobPostingSerializer,
)
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

    def get_serializer_class(self):
        if self.request.method == "GET":
            return EmployerJobListSerializer
        return JobPostingSerializer

    def get_queryset(self):
        owner = workspace_owner(self.request.user)
        qs = JobPosting.objects.filter(employer=owner).select_related("job_category")
        if self.request.method == "GET":
            return qs.order_by("-created_at")
        return qs.prefetch_related("skills").order_by("-created_at")

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
    """Keyword and optional location/category/work-mode filters over open jobs."""

    serializer_class = JobPostingPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            JobPosting.objects.public_live()
            .select_related("job_category", "employer")
            .prefetch_related("skills")
        )
        keyword = (self.request.query_params.get("keyword") or "").strip()
        fuzzy_enabled = fuzzy_search_enabled()
        if keyword:
            qs = qs.annotate(
                _wot_txt=Cast("whats_on_offer", TextField()),
                _lfp_txt=Cast("looking_for_people_bullets", TextField()),
                _lfa_txt=Cast("looking_for_additional_bullets", TextField()),
                _rb_txt=Cast("role_bullets", TextField()),
                _wcu_txt=Cast("why_choose_us_bullets", TextField()),
            )
            exact_keyword_q = (
                Q(title__icontains=keyword)
                | Q(jd_text__icontains=keyword)
                | Q(location__icontains=keyword)
                | Q(company_info__icontains=keyword)
                | Q(how_to_apply__icontains=keyword)
                | Q(licenses_certifications__icontains=keyword)
                | Q(job_category__name__icontains=keyword)
                | Q(skills__skill_name__icontains=keyword)
                | Q(employer__company_profile__location__icontains=keyword)
                | Q(employer__company_profile__suburb__icontains=keyword)
                | Q(employer__company_profile__city__icontains=keyword)
                | Q(employer__company_profile__postcode__icontains=keyword)
                | Q(employer__company_profile__state_region__icontains=keyword)
                | Q(_wot_txt__icontains=keyword)
                | Q(_lfp_txt__icontains=keyword)
                | Q(_lfa_txt__icontains=keyword)
                | Q(_rb_txt__icontains=keyword)
                | Q(_wcu_txt__icontains=keyword)
            )

            qs = apply_keyword_filter(
                qs,
                keyword=keyword,
                exact_q=exact_keyword_q,
                token_predicate=_job_token_q,
                fuzzy_fields=_JOB_FUZZY_FIELDS,
                fuzzy_enabled=fuzzy_enabled,
            )

        cat = (self.request.query_params.get("category") or "").strip()
        if cat.isdigit():
            qs = qs.filter(job_category_id=int(cat))

        wm = (self.request.query_params.get("work_mode") or "").strip().lower()
        if wm in {JobPosting.WorkMode.REMOTE, JobPosting.WorkMode.HYBRID, JobPosting.WorkMode.ONSITE}:
            qs = qs.filter(work_mode=wm)

        loc_terms_raw = (self.request.query_params.get("loc_terms") or "").strip()
        location_str = (self.request.query_params.get("location") or "").strip()
        terms: list[str] = []
        if loc_terms_raw:
            terms = [t.strip().lower() for t in loc_terms_raw.split(",") if len(t.strip()) >= 2]
        elif location_str:
            parts = [t.strip().lower() for t in location_str.split(",") if len(t.strip()) >= 2]
            terms = parts if parts else ([location_str.lower()] if len(location_str) >= 2 else [])

        for t in terms:
            qs = qs.filter(_job_location_token_q(t))

        if keyword:
            annotations = {
                "_rank_title": Case(When(title__icontains=keyword, then=Value(60)), default=Value(0), output_field=IntegerField()),
                "_rank_skill": Case(When(skills__skill_name__icontains=keyword, then=Value(30)), default=Value(0), output_field=IntegerField()),
                "_rank_category": Case(When(job_category__name__icontains=keyword, then=Value(20)), default=Value(0), output_field=IntegerField()),
                "_rank_text": Case(When(jd_text__icontains=keyword, then=Value(10)), default=Value(0), output_field=IntegerField()),
                "_rank_location": Case(When(location__icontains=keyword, then=Value(8)), default=Value(0), output_field=IntegerField()),
            }
            annotations.update(maybe_fuzzy_rank_annotation(fuzzy_enabled))
            qs = qs.annotate(**annotations)
            order = ["-_rank_title", "-_rank_skill"]
            if fuzzy_enabled:
                order.append("-_rank_fuzzy")
            order.extend(["-_rank_category", "-_rank_text", "-_rank_location", "-created_at"])
            qs = qs.order_by(*order)
            return qs
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
