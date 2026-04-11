import uuid

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsEmployer

from .models import CompanyProfile, EmployerTeamInvite
from .serializers import EmployerTeamInviteCreateSerializer, EmployerTeamInviteReadSerializer
from .utils_workspace import workspace_owner


class EmployerTeamInvitePreviewView(APIView):
    """Public: validate invite token for employer registration screen."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            token_uuid = uuid.UUID(str(token))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid invite link."}, status=status.HTTP_400_BAD_REQUEST)
        invite = (
            EmployerTeamInvite.objects.filter(token=token_uuid, accepted_at__isnull=True)
            .select_related("organization_owner")
            .first()
        )
        if not invite:
            return Response({"detail": "This invitation is not valid or has already been used."}, status=404)
        owner = invite.organization_owner
        prof = CompanyProfile.objects.filter(user=owner).first()
        if not prof or not prof.profile_completed:
            return Response({"detail": "This invitation is no longer valid."}, status=410)
        return Response(
            {
                "email": invite.email,
                "company_name": prof.company_name or "",
            }
        )


class EmployerTeamInviteListCreateView(generics.ListCreateAPIView):
    """List pending invites for your workspace, or send a new invite."""

    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmployerTeamInviteCreateSerializer
        return EmployerTeamInviteReadSerializer

    def get_queryset(self):
        owner = workspace_owner(self.request.user)
        return (
            EmployerTeamInvite.objects.filter(organization_owner=owner)
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().filter(accepted_at__isnull=True)
        serializer = EmployerTeamInviteReadSerializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = EmployerTeamInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        owner = workspace_owner(request.user)
        if email == (request.user.email or "").strip().lower():
            return Response({"email": "Use a colleague's email, not your own."}, status=400)
        if email == (owner.email or "").strip().lower():
            return Response({"email": "That email is already the workspace owner."}, status=400)
        prof = CompanyProfile.objects.filter(user=owner).first()
        if not prof or not prof.profile_completed:
            return Response(
                {"detail": "Complete your company profile before inviting teammates."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pending = EmployerTeamInvite.objects.filter(
            organization_owner=owner, email__iexact=email, accepted_at__isnull=True
        ).first()
        if pending:
            out = EmployerTeamInviteReadSerializer(pending)
            return Response(out.data, status=status.HTTP_200_OK)
        invite = EmployerTeamInvite.objects.create(
            email=email,
            invited_by=request.user,
            organization_owner=owner,
        )
        return Response(EmployerTeamInviteReadSerializer(invite).data, status=status.HTTP_201_CREATED)
