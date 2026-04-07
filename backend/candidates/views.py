from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from accounts.permissions import IsCandidate
from .models import CandidateProfile, CandidateSkill, ResumeDocument
from .resume_parser import extract_text_from_upload, parse_resume_text
from .serializers import CandidateProfileSerializer, ResumeUploadSerializer


class CandidateProfileUpsertView(generics.GenericAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def get(self, request):
        profile = CandidateProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({}, status=status.HTTP_200_OK)
        return Response(self.get_serializer(profile).data)

    def post(self, request):
        profile = CandidateProfile.objects.filter(user=request.user).first()
        if profile:
            serializer = self.get_serializer(profile, data=request.data, partial=True)
        else:
            serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CandidateListView(generics.ListAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = CandidateProfile.objects.all().order_by("-id")


class CandidateSearchView(generics.ListAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = CandidateProfile.objects.all()
        skill = self.request.query_params.get("skills")
        education = self.request.query_params.get("education")
        experience_min = self.request.query_params.get("experience_min")
        location = self.request.query_params.get("location")

        if skill:
            qs = qs.filter(skills__skill_name__icontains=skill)
        if education:
            qs = qs.filter(education_level__icontains=education)
        if experience_min:
            try:
                qs = qs.filter(years_experience__gte=int(experience_min))
            except ValueError:
                pass
        if location:
            qs = qs.filter(location__icontains=location)
        return qs.distinct().order_by("-id")


class ResumeUploadView(generics.GenericAPIView):
    serializer_class = ResumeUploadSerializer
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request):
        profile, _ = CandidateProfile.objects.get_or_create(
            user=request.user, defaults={"full_name": request.user.username or request.user.email}
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resume = ResumeDocument.objects.create(candidate=profile, file=serializer.validated_data["file"])
        raw_text = extract_text_from_upload(serializer.validated_data["file"])
        parsed = parse_resume_text(raw_text)
        resume.raw_text = raw_text
        resume.parsed_json = parsed
        resume.parsed_at = parse_datetime(parsed["parsed_at"])
        resume.save()

        profile.education_level = profile.education_level or parsed.get("education_level", "")
        profile.years_experience = max(profile.years_experience, parsed.get("years_experience", 0))
        profile.save()
        for skill in parsed.get("skills", []):
            CandidateSkill.objects.get_or_create(candidate=profile, skill_name=skill, defaults={"level": 1})

        return Response(ResumeUploadSerializer(resume).data, status=status.HTTP_201_CREATED)


class ResumeReprocessView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsCandidate]

    def post(self, request, resume_id):
        resume = ResumeDocument.objects.filter(id=resume_id, candidate__user=request.user).first()
        if not resume:
            return Response({"detail": "Resume not found"}, status=status.HTTP_404_NOT_FOUND)
        raw_text = extract_text_from_upload(resume.file)
        parsed = parse_resume_text(raw_text)
        resume.raw_text = raw_text
        resume.parsed_json = parsed
        resume.parsed_at = parse_datetime(parsed["parsed_at"])
        resume.save()
        return Response(ResumeUploadSerializer(resume).data)
