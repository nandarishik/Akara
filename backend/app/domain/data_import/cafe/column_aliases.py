"""Café column aliases and channel value normalization."""

from __future__ import annotations

CANONICAL_ORDER_ALIASES: dict[str, str] = {
    "order time": "order_time",
    "order_time": "order_time",
    "bill time": "order_time",
    "invoice date": "order_time",
    "date": "order_time",
    "bill no": "external_order_id",
    "bill number": "external_order_id",
    "order no": "external_order_id",
    "order id": "external_order_id",
    "invoice number": "external_order_id",
    "web_billno": "external_order_id",
    "covers": "covers",
    "pax": "covers",
    "guests": "covers",
    "channel": "channel",
    "order type": "channel",
    "order_type": "channel",
    "source": "channel",
    "table no": "table_no",
    "table": "table_no",
    "waiter": "waiter",
    "server": "waiter",
    "payment mode": "payment_mode",
    "payment": "payment_mode",
    "total": "total_amount",
    "bill amt": "total_amount",
    "bill amount": "total_amount",
    "total amount": "total_amount",
    "net amount": "total_amount",
    "grand total": "total_amount",
    "tax": "tax_amount",
    "discount": "discount_amount",
    "item": "item_name",
    "item name": "item_name",
    "qty": "quantity",
    "quantity": "quantity",
}

CHANNEL_VALUE_MAP: dict[str, str] = {
    "dine in": "dine-in",
    "dine-in": "dine-in",
    "dinein": "dine-in",
    "takeaway": "takeaway",
    "take away": "takeaway",
    "pickup": "takeaway",
    "delivery": "delivery",
    "swiggy": "aggregator",
    "zomato": "aggregator",
    "aggregator": "aggregator",
    "online": "online",
    "other": "other",
}

EXPENSE_ALIASES: dict[str, str] = {
    "date": "expense_date",
    "expense date": "expense_date",
    "category": "category",
    "amount": "amount",
    "vendor": "vendor",
    "notes": "notes",
}

EXPENSE_CATEGORY_MAP: dict[str, str] = {
    "food": "food_cost",
    "cogs": "food_cost",
    "labour": "labour",
    "labor": "labour",
    "rent": "rent",
    "utilities": "utilities",
    "electricity": "utilities",
    "marketing": "marketing",
    "maintenance": "maintenance",
    "packaging": "packaging",
    "commission": "aggregator_commission",
    "other": "other",
}

INVENTORY_ALIASES: dict[str, str] = {
    "item": "item_name",
    "item name": "item_name",
    "sku": "sku",
    "qty": "quantity",
    "quantity": "quantity",
    "unit": "unit",
    "reorder": "reorder_point",
    "reorder point": "reorder_point",
    "cost": "cost_per_unit",
    "cost per unit": "cost_per_unit",
    "supplier": "supplier_name",
    "category": "category",
}

REQUIRED_ORDER_FIELDS = frozenset({"order_time", "total_amount"})
REQUIRED_EXPENSE_FIELDS = frozenset({"expense_date", "amount", "category"})
REQUIRED_INVENTORY_FIELDS = frozenset({"item_name", "quantity"})


def norm(value: str) -> str:
    return " ".join((value or "").strip().lower().replace("_", " ").split())
