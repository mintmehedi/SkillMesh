from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0012_job_looking_role_bullets"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobposting",
            name="why_choose_us_bullets",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
