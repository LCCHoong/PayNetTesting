"""Regression checks for compact, customer-safe menu responses."""
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1/test")
os.environ.setdefault("SECRET_KEY", "test-only-secret-never-use-in-production-0123456789")
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")

import unittest
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from main import public_menu_item, validate_menu_image_url


class MenuDeliveryTests(unittest.TestCase):
    def item(self, image_url):
        return SimpleNamespace(
            id=uuid4(),
            merchant_id=uuid4(),
            name="Nasi Lemak",
            description="Fresh",
            price=Decimal("6.50"),
            image_url=image_url,
            is_available=True,
            created_at=datetime.now(timezone.utc),
        )

    def test_legacy_data_url_is_replaced_by_small_image_endpoint(self):
        item = self.item("data:image/png;base64," + "A" * 1000)
        payload = public_menu_item(item)
        self.assertEqual(payload["image_url"], f"/menu-items/{item.id}/image")
        self.assertEqual(payload["price"], 6.5)

    def test_normal_cloud_image_url_is_preserved(self):
        url = "https://example.supabase.co/storage/v1/object/public/menu/item.png"
        self.assertEqual(public_menu_item(self.item(url))["image_url"], url)

    def test_new_items_cannot_store_embedded_or_invalid_images(self):
        for invalid in ("data:image/png;base64,AAAA", "javascript:alert(1)"):
            with self.assertRaises(HTTPException):
                validate_menu_image_url(invalid)
        self.assertEqual(validate_menu_image_url(" https://example.com/item.png "), "https://example.com/item.png")
        self.assertIsNone(validate_menu_image_url(""))


if __name__ == "__main__":
    unittest.main()
