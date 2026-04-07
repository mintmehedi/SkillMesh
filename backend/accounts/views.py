from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.response import Response

from .serializers import MeSerializer, RegisterSerializer


User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.GenericAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(self.get_serializer(request.user).data)
