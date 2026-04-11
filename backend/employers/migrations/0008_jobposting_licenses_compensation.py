from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0007_companyprofile_suburb"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobposting",
            name="licenses_certifications",
            field=models.TextField(
                blank=True,
                help_text="Optional licences, certifications, or clearances for this role.",
            ),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="compensation_period",
            field=models.CharField(
                choices=[
                    ("not_specified", "Not specified"),
                    ("hourly", "Hourly"),
                    ("yearly", "Yearly (salary)"),
                    ("monthly", "Monthly"),
                    ("daily", "Daily"),
                ],
                default="not_specified",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="compensation_amount_min",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Optional lower bound; currency implied by employer / region.",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="compensation_amount_max",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Optional upper bound.",
                max_digits=12,
                null=True,
            ),
        ),
    ]
