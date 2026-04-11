from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0006_companyprofile_country_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="companyprofile",
            name="suburb",
            field=models.CharField(
                blank=True,
                help_text="Suburb / district (separate from city or town).",
                max_length=120,
            ),
        ),
    ]
