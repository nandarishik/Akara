"""Probe remote Supabase schema — no secrets printed."""
import os
import uuid

import httpx
from dotenv import load_dotenv

load_dotenv()

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}

TENANT_ID = str(uuid.UUID(int=0))


def check_table(name: str) -> int:
    r = httpx.get(
        f"{URL}/rest/v1/{name}?select=id&limit=1",
        headers=HEADERS,
        timeout=20,
    )
    return r.status_code


def check_rpc(name: str, body: dict) -> int:
    r = httpx.post(
        f"{URL}/rest/v1/rpc/{name}",
        headers=HEADERS,
        json=body,
        timeout=20,
    )
    return r.status_code


def main() -> None:
    print(f"Project: {URL}")
    tables = [
        "tenants",
        "profiles",
        "sales_data",
        "secondary_sales_data",
        "scheme_master",
        "conversations",
        "chat_history",
    ]
    for t in tables:
        print(f"  table {t}: {check_table(t)}")

    rpcs = {
        "get_kpi_summary": {
            "p_tenant_id": TENANT_ID,
            "p_start_date": "2024-01-01",
            "p_end_date": "2024-12-31",
        },
        "execute_tenant_query": {
            "p_query": "SELECT 1 AS ok",
            "p_params": {},
        },
        "update_tenant_config": {
            "p_tenant_id": TENANT_ID,
            "p_patch": {"language": "en"},
        },
        "get_scheme_leakage": {"p_tenant_id": TENANT_ID},
        "get_conversations_with_counts": {},
    }
    for name, body in rpcs.items():
        print(f"  rpc {name}: {check_rpc(name, body)}")

    r = httpx.get(
        f"{URL}/rest/v1/profiles?select=preferences&limit=1",
        headers=HEADERS,
        timeout=20,
    )
    if r.status_code == 200:
        print("  profiles.preferences column: ok")
    elif r.status_code == 400 and "preferences" in r.text:
        print("  profiles.preferences column: MISSING (400)")
    else:
        print(f"  profiles.preferences column: HTTP {r.status_code}")


if __name__ == "__main__":
    main()
