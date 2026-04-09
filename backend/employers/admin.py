from django.contrib import admin

from .models import CompanyProfile, JobCategory, JobPosting, JobSkill


admin.site.register(JobCategory)
admin.site.register(CompanyProfile)
admin.site.register(JobPosting)
admin.site.register(JobSkill)
