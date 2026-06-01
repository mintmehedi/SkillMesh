from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCandidate
from .models import Application
from .serializers import ApplicationSerializer


class ApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return (
            Application.objects.filter(candidate=self.request.user)
            .select_related("resume", "job", "job__employer", "job__employer__company_profile")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                self.perform_create(serializer)
        except IntegrityError:
            raise ValidationError({"detail": "You have already applied to this job."})
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save(candidate=self.request.user)


class ApplicationWithdrawView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request, pk):
        app = get_object_or_404(
            Application.objects.filter(candidate=request.user),
            pk=pk,
        )
        if app.status == Application.Status.WITHDRAWN:
            return Response(ApplicationSerializer(app, context={"request": request}).data)
        if app.status in (Application.Status.ACCEPTED, Application.Status.REJECTED):
            raise ValidationError({"detail": "This application can no longer be withdrawn."})
        app.status = Application.Status.WITHDRAWN
        app.save(update_fields=["status"])
        return Response(ApplicationSerializer(app, context={"request": request}).data)
