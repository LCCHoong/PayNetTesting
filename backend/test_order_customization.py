import os
import unittest
from uuid import uuid4

from pydantic import ValidationError

os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@127.0.0.1/test"
os.environ["SECRET_KEY"] = "test-only-secret-never-use-in-production-0123456789"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""

from email_service import _item_description
from main import OrderItemCreate


class OrderCustomizationTests(unittest.TestCase):
    def test_order_line_accepts_special_instructions(self):
        line = OrderItemCreate(
            menu_item_id=uuid4(),
            quantity=2,
            special_instructions="Sugar: Less sugar | Ice: No ice",
        )
        self.assertEqual(line.special_instructions, "Sugar: Less sugar | Ice: No ice")

    def test_order_line_limits_instruction_length(self):
        with self.assertRaises(ValidationError):
            OrderItemCreate(
                menu_item_id=uuid4(),
                special_instructions="x" * 301,
            )

    def test_email_escapes_customer_supplied_text(self):
        rendered = _item_description({
            "name": "Iced <Latte>",
            "special_instructions": "No sugar <script>alert(1)</script>",
        })
        self.assertIn("Iced &lt;Latte&gt;", rendered)
        self.assertIn("&lt;script&gt;", rendered)
        self.assertNotIn("<script>", rendered)


if __name__ == "__main__":
    unittest.main()
