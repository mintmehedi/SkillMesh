from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0002_application_resume_cover_letter"),
    ]

    operations = [
        migrations.AlterField(
            model_name="application",
            name="status",
            field=models.CharField(
                choices=[
                    ("applied", "Applied"),
                    ("reviewing", "Reviewing"),
                    ("rejected", "Rejected"),
                    ("accepted", "Accepted"),
                    ("withdrawn", "Withdrawn"),
                ],
                default="applied",
                max_length=20,
            ),
        ),
    ]
