import mimetypes

from django.http import FileResponse, Http404
from rest_framework import generics, permissions
from rest_framework.views import APIView

from accounts.permissions import IsEmployer
from employers.utils_workspace import workspace_owner

from .employer_serializers import EmployerApplicationDetailSerializer, EmployerApplicationListSerializer
from .models import Application


def _employer_application_base_qs(user):
    owner = workspace_owner(user)
    return Application.objects.filter(job__employer=owner).select_related(
        "job",
        "candidate",
        "candidate__candidate_profile",
        "resume",
    )


class EmployerApplicationListView(generics.ListAPIView):
    serializer_class = EmployerApplicationListSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        qs = _employer_application_base_qs(self.request.user)
        job_id = self.request.query_params.get("job")
        if job_id and str(job_id).isdigit():
            qs = qs.filter(job_id=int(job_id))
        return qs.order_by("-created_at")


class EmployerApplicationDetailView(generics.RetrieveAPIView):
    serializer_class = EmployerApplicationDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_queryset(self):
        return _employer_application_base_qs(self.request.user)


class EmployerApplicationResumeDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmployer]
    http_method_names = ["get", "head", "options"]

    def get(self, request, pk):
        app = _employer_application_base_qs(request.user).filter(pk=pk).first()
        if not app or not app.resume or not app.resume.file:
            raise Http404()
        fh = app.resume.file.open("rb")
        name = app.resume.file.name
        content_type, _ = mimetypes.guess_type(name)
        if not content_type:
            content_type = "application/octet-stream"
        basename = name.rsplit("/", 1)[-1] if name else "resume"
        resp = FileResponse(fh, content_type=content_type)
        resp["Content-Disposition"] = f'inline; filename="{basename}"'
        return resp


class EmployerApplicationCoverLetterDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmployer]
    http_method_names = ["get", "head", "options"]

    def get(self, request, pk):
        app = _employer_application_base_qs(request.user).filter(pk=pk).first()
        if (
            not app
            or app.cover_letter_mode != Application.CoverLetterMode.UPLOAD
            or not app.cover_letter_file
        ):
            raise Http404()
        fh = app.cover_letter_file.open("rb")
        name = app.cover_letter_file.name
        content_type, _ = mimetypes.guess_type(name)
        if not content_type:
            content_type = "application/octet-stream"
        basename = name.rsplit("/", 1)[-1] if name else "cover-letter"
        resp = FileResponse(fh, content_type=content_type)
        resp["Content-Disposition"] = f'inline; filename="{basename}"'
        return resp
