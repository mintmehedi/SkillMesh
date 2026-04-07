from django.contrib import admin

from .models import CompanyProfile, JobPosting, JobSkill


admin.site.register(CompanyProfile)
admin.site.register(JobPosting)
admin.site.register(JobSkill)
