from django.test import SimpleTestCase

from core.search_fuzzy import FUZZY_MATCH_THRESHOLD, keyword_tokens


class KeywordTokenTests(SimpleTestCase):
    def test_splits_and_filters_short_tokens(self):
        self.assertEqual(keyword_tokens("Senior RN"), ["senior", "rn"])
        self.assertEqual(keyword_tokens("  a  bb  "), ["bb"])

    def test_match_threshold_is_stable(self):
        self.assertEqual(FUZZY_MATCH_THRESHOLD, 0.18)
