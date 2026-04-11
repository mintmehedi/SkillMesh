from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0005_company_profile_extended"),
    ]

    operations = [
        migrations.AddField(
            model_name="companyprofile",
            name="country_code",
            field=models.CharField(
                blank=True,
                help_text="ISO 3166-1 alpha-2, for address lookups.",
                max_length=2,
            ),
        ),
    ]
