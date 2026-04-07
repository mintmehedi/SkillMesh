from rest_framework import generics, permissions
from rest_framework.response import Response

from accounts.permissions import IsEmployer
from .models import CompanyProfile, JobPosting
from .serializers import CompanyProfileSerializer, JobPostingSerializer


class CompanyProfileUpsertView(generics.GenericAPIView):
    serializer_class = CompanyProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get(self, request):
        profile = CompanyProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({})
        return Response(self.get_serializer(profile).data)

    def post(self, request):
        profile = CompanyProfile.objects.filter(user=request.user).first()
        if profile:
            serializer = self.get_serializer(profile, data=request.data, partial=True)
        else:
            serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data)


class EmployerJobListCreateView(generics.ListCreateAPIView):
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        return JobPosting.objects.filter(employer=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(employer=self.request.user)


class EmployerJobDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        return JobPosting.objects.filter(employer=self.request.user)


class JobListView(generics.ListAPIView):
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = JobPosting.objects.all().order_by("-created_at")


class JobSearchView(generics.ListAPIView):
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = JobPosting.objects.all()
        keyword = self.request.query_params.get("keyword")
        if keyword:
            qs = qs.filter(jd_text__icontains=keyword)
        return qs.order_by("-created_at")
