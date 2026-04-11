from django.db import migrations, models


def mark_existing_profiles_complete(apps, schema_editor):
    CompanyProfile = apps.get_model("employers", "CompanyProfile")
    CompanyProfile.objects.all().update(profile_completed=True)


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0004_more_job_categories"),
    ]

    operations = [
        migrations.AddField(
            model_name="companyprofile",
            name="industry",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="company_size",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="founded_year",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="phone",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="contact_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="country",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="state_region",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="city",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="street_address",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="postcode",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="business_registration_number",
            field=models.CharField(
                blank=True,
                help_text="ABN, ACN, or other business registration identifier.",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="linkedin_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="companyprofile",
            name="profile_completed",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="companyprofile",
            name="location",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RunPython(mark_existing_profiles_complete, migrations.RunPython.noop),
    ]
