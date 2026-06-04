from rest_framework import permissions, status, views
from rest_framework.response import Response

from accounts.membership import is_premium_company
from accounts.permissions import IsEmployer
from employers.dashboard_analytics import build_dashboard_charts
from employers.utils_workspace import workspace_owner


class EmployerDashboardAnalyticsView(views.APIView):
    """
    Premium-only hiring analytics rendered with matplotlib (PNG, base64 in JSON).
    """

    permission_classes = [permissions.IsAuthenticated, IsEmployer]

    def get(self, request):
        if not is_premium_company(request.user):
            return Response(
                {
                    "premium_required": True,
                    "detail": "Company Premium unlocks hiring analytics charts on your dashboard.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        owner = workspace_owner(request.user)
        charts, summary = build_dashboard_charts(owner.id)
        return Response(
            {
                "premium_required": False,
                "summary": summary,
                "charts": charts,
            }
        )
