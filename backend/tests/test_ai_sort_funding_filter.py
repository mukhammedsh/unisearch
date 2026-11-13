import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.routers import universities as universities_router
from app.services import admissions_catalog
from app.services import universities as universities_service


class AiSortFundingFilterTests(unittest.TestCase):
    """UniFit applies the profile's funding type like the other catalog sorts: only a known "no" excludes."""

    def setUp(self):
        with universities_router._AI_SORT_CACHE_LOCK:
            universities_router._AI_SORT_CACHE.clear()
        self.client = TestClient(app)
        items, meta = universities_service.get_universities_with_meta()
        legacy = [
            (row, dict(meta_row))
            for row, meta_row in zip(items, meta)
            if row.get("id") not in admissions_catalog.INSTITUTION_IDS
        ][:3]
        self.assertEqual(len(legacy), 3)
        # Known no grant, known grant, unknown grant availability.
        for (_, meta_row), has_grant in zip(legacy, (False, True, None)):
            meta_row["has_grant"] = has_grant
        self.no_grant_id, self.grant_id, self.unknown_id = (row["id"] for row, _ in legacy)
        self.pairs = legacy

    def _ai_sort_ids(self, **extra):
        rows = [row for row, _ in self.pairs]
        metas = [meta_row for _, meta_row in self.pairs]
        with patch.object(universities_service, "get_universities_with_meta", return_value=(rows, metas)), patch.object(
            universities_router.ai_scoring_service,
            "sort_universities_ai",
            side_effect=lambda items, **kwargs: list(items),
        ):
            response = self.client.post("/universities/ai-sort", json={"profile": {}, "page": 1, "limit": 24, **extra})
        self.assertEqual(response.status_code, 200)
        return [item["id"] for item in response.json()["items"]]

    def test_grant_only_excludes_known_no_grant_and_keeps_unknown(self):
        ids = self._ai_sort_ids(funding_type="grant")
        self.assertNotIn(self.no_grant_id, ids)
        self.assertIn(self.grant_id, ids)
        self.assertIn(self.unknown_id, ids)

    def test_any_funding_keeps_every_university(self):
        ids = self._ai_sort_ids()
        self.assertEqual({self.no_grant_id, self.grant_id, self.unknown_id}, set(ids))

    def test_cached_result_does_not_leak_across_funding_types(self):
        self.assertIn(self.no_grant_id, self._ai_sort_ids())
        self.assertNotIn(self.no_grant_id, self._ai_sort_ids(funding_type="grant"))


if __name__ == "__main__":
    unittest.main()
