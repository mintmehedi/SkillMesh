from rest_framework import generics, permissions

from accounts.permissions import IsCandidate
from .models import Application
from .serializers import ApplicationSerializer


class ApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def get_queryset(self):
        return Application.objects.filter(candidate=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(candidate=self.request.user)
