from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_candidatemembership"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompanyMembership",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "plan_type",
                    models.CharField(
                        choices=[("free", "Free"), ("premium", "Premium")],
                        default="free",
                        max_length=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Active"), ("cancelled", "Cancelled")],
                        default="active",
                        max_length=16,
                    ),
                ),
                ("monthly_price", models.DecimalField(decimal_places=2, default=9.99, max_digits=6)),
                ("member_since", models.DateTimeField(blank=True, null=True)),
                ("cancelled_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        help_text="Membership is tracked on the employer workspace owner.",
                        limit_choices_to={"role": "employer"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="company_membership",
                        to="accounts.user",
                    ),
                ),
            ],
        ),
    ]
