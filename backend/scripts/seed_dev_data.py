"""Seed akara-dev with synthetic café tenants and sales_data.

Usage (from backend/, with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for akara-dev):
  uv run python scripts/seed_dev_data.py

Aborts if ENVIRONMENT=production or the Supabase URL host contains akara-production.
No new Python dependencies. Prefer tenants + sales_data only (no Auth admin required).
"""
from __future__ import annotations

import os
import random
import sys
import uuid
from datetime import date, timedelta
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

load_dotenv()

ROWS_PER_TENANT = 10_000
BATCH_SIZE = 500

CAFES = (
    {
        "name": "Chai Corner Indiranagar",
        "slug": "chai-corner-blr",
        "city": "Bengaluru",
        "zone": "South",
    },
    {
        "name": "Filter Coffee House Pune",
        "slug": "filter-coffee-pune",
        "city": "Pune",
        "zone": "West",
    },
    {
        "name": "Masala Dosa Hub Chennai",
        "slug": "masala-dosa-chennai",
        "city": "Chennai",
        "zone": "South",
    },
)

PRODUCTS = (
    ("Filter Coffee", "Beverages", "Hot Drink"),
    ("Masala Chai", "Beverages", "Hot Drink"),
    ("Masala Dosa", "Food", "South Indian"),
    ("Idli Sambhar", "Food", "South Indian"),
    ("Vada Pav", "Food", "Snack"),
    ("Samosa Plate", "Food", "Snack"),
    ("Cold Brew", "Beverages", "Cold Drink"),
    ("Butter Cookie Pack", "Retail", "Bakery"),
)

PARTIES = (
    "Synthetic Cafe Walk-in",
    "Demo Office Catering Co",
    "Fictional Hostel Mess",
    "Example Test Kitchen",
    "Placeholder Food Court Stall",
)


def _abort(msg: str) -> None:
    print(msg, file=sys.stderr)
    sys.exit(1)


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        _abort(f"Missing {name}")
    return value


def _guard_not_production(url: str) -> None:
    env = os.environ.get("ENVIRONMENT", "").strip().lower()
    if env == "production":
        _abort("Refusing to seed: ENVIRONMENT=production")
    host = (urlparse(url).hostname or "").lower()
    if "akara-production" in host:
        _abort(f"Refusing to seed: URL host looks like production ({host})")


def _headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _ensure_tenant(client: httpx.Client, base: str, headers: dict[str, str], cafe: dict) -> str:
    existing = client.get(
        f"{base}/rest/v1/tenants?slug=eq.{cafe['slug']}&select=id",
        headers=headers,
    )
    if existing.status_code == 200 and existing.json():
        tenant_id = existing.json()[0]["id"]
        print(f"Using existing tenant {cafe['slug']}: {tenant_id}")
        return tenant_id

    resp = client.post(
        f"{base}/rest/v1/tenants",
        headers=headers,
        json={
            "name": cafe["name"],
            "slug": cafe["slug"],
            "config": {
                "company_name": cafe["name"],
                "industry": "cafe_fictional",
                "primary_table": "sales_data",
                "timezone": "Asia/Kolkata",
                "language": "en",
                "seed": "synthetic_p03",
            },
        },
    )
    if resp.status_code not in (200, 201):
        _abort(f"Failed to create tenant {cafe['slug']}: {resp.status_code} {resp.text}")
    tenant_id = resp.json()[0]["id"]
    print(f"Created tenant {cafe['slug']}: {tenant_id}")
    return tenant_id


def _row(tenant_id: str, rng: random.Random, day_offset: int) -> dict:
    product_name, product_group, product_category = rng.choice(PRODUCTS)
    qty = round(rng.uniform(1, 24), 3)
    unit = round(rng.uniform(20, 350), 2)
    gross = round(qty * unit, 2)
    discount = round(gross * rng.choice((0.0, 0.05, 0.1)), 2)
    net = round(gross - discount, 2)
    tax = round(net * 0.05, 2)
    total = round(net + tax, 2)
    inv_date = date.today() - timedelta(days=day_offset % 365)
    return {
        "tenant_id": tenant_id,
        "invoice_date": inv_date.isoformat(),
        "invoice_number": f"SYN-{uuid.uuid4().hex[:10].upper()}",
        "party_name": rng.choice(PARTIES),
        "party_city": rng.choice(("Bengaluru", "Pune", "Chennai", "Hyderabad", "Mumbai")),
        "party_zone": rng.choice(("North", "South", "East", "West")),
        "product_name": product_name,
        "product_group": product_group,
        "product_category": product_category,
        "quantity": qty,
        "gross_amount": gross,
        "discount_amount": discount,
        "net_amount": net,
        "tax_amount": tax,
        "total_amount": total,
    }


def _seed_sales(
    client: httpx.Client,
    base: str,
    headers: dict[str, str],
    tenant_id: str,
    cafe_slug: str,
) -> int:
    count = client.get(
        f"{base}/rest/v1/sales_data?tenant_id=eq.{tenant_id}&select=id",
        headers={**headers, "Prefer": "count=exact", "Range": "0-0"},
    )
    existing = 0
    if "content-range" in count.headers:
        # content-range: 0-0/12345
        try:
            existing = int(count.headers["content-range"].split("/")[-1])
        except ValueError:
            existing = 0
    if existing >= ROWS_PER_TENANT:
        print(f"{cafe_slug}: already has {existing} sales_data rows — skip insert")
        return existing

    need = ROWS_PER_TENANT - existing
    rng = random.Random(f"akara-seed-{cafe_slug}")
    inserted = 0
    insert_headers = {**headers, "Prefer": "return=minimal"}
    while inserted < need:
        batch_n = min(BATCH_SIZE, need - inserted)
        batch = [_row(tenant_id, rng, inserted + i) for i in range(batch_n)]
        resp = client.post(f"{base}/rest/v1/sales_data", headers=insert_headers, json=batch)
        if resp.status_code not in (200, 201):
            _abort(f"sales_data insert failed for {cafe_slug}: {resp.status_code} {resp.text}")
        inserted += batch_n
        if inserted % 2000 == 0 or inserted == need:
            print(f"{cafe_slug}: inserted {inserted}/{need} new rows")
    return existing + inserted


def main() -> None:
    url = _require_env("SUPABASE_URL").rstrip("/")
    service_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    _guard_not_production(url)

    print("Tables filled: tenants, sales_data (no Auth users — Auth admin not required)")
    print(f"Target: {urlparse(url).hostname}")

    with httpx.Client(timeout=120) as client:
        headers = _headers(service_key)
        for cafe in CAFES:
            tid = _ensure_tenant(client, url, headers, cafe)
            n = _seed_sales(client, url, headers, tid, cafe["slug"])
            print(f"{cafe['slug']}: sales_data total ≈ {n}")

    print("Seed complete (synthetic café data only — no real PII).")


if __name__ == "__main__":
    main()
