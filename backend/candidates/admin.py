from django.contrib import admin

from .models import CandidateProfile, CandidateSkill, ResumeDocument, WorkExperience


admin.site.register(CandidateProfile)
admin.site.register(CandidateSkill)
admin.site.register(ResumeDocument)
admin.site.register(WorkExperience)
