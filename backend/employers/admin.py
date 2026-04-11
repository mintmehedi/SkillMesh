from django.contrib import admin

from .models import CompanyProfile, EmployerTeamInvite, JobCategory, JobPosting, JobSkill


admin.site.register(JobCategory)
admin.site.register(CompanyProfile)
admin.site.register(JobPosting)
admin.site.register(JobSkill)
admin.site.register(EmployerTeamInvite)
