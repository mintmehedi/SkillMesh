from django.db import migrations


def seed_job_categories(apps, schema_editor):
    JobCategory = apps.get_model("employers", "JobCategory")
    rows = [
        ("software-it", "Software & IT", 10),
        ("data-analytics", "Data & Analytics", 20),
        ("healthcare", "Healthcare", 30),
        ("finance", "Finance & Accounting", 40),
        ("education", "Education", 50),
        ("marketing", "Marketing & Communications", 60),
        ("sales", "Sales", 70),
        ("engineering", "Engineering (non-IT)", 80),
        ("design", "Design & Creative", 90),
        ("hr", "Human Resources", 100),
        ("operations", "Operations & Logistics", 110),
        ("legal", "Legal", 120),
    ]
    for slug, name, sort_order in rows:
        JobCategory.objects.update_or_create(
            slug=slug,
            defaults={"name": name, "sort_order": sort_order},
        )


def unseed_job_categories(apps, schema_editor):
    JobCategory = apps.get_model("employers", "JobCategory")
    JobCategory.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0002_candidate_onboarding_and_categories"),
    ]

    operations = [
        migrations.RunPython(seed_job_categories, unseed_job_categories),
    ]
