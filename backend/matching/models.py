from django.db import models


class RecommendationLog(models.Model):
    subject_type = models.CharField(max_length=20)
    subject_id = models.IntegerField()
    target_id = models.IntegerField()
    score = models.FloatField()
    explanation_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
