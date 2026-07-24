"""Full Supabase migration verification."""
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON = os.environ["SUPABASE_ANON_KEY"]
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}
ZERO = "00000000-0000-0000-0000-000000000000"


def check_table(name: str, select_col: str = "id") -> tuple[bool, int]:
    r = httpx.get(
        f"{URL}/rest/v1/{name}?select={select_col}&limit=1",
        headers=HEADERS,
        timeout=20,
    )
    return r.status_code == 200, r.status_code


def check_table_any(names: list[str], select_col: str = "id") -> tuple[bool, int, str]:
    last_code = 404
    for name in names:
        ok, code = check_table(name, select_col)
        if ok:
            return True, code, name
        last_code = code
    return False, last_code, names[0]


def check_column(table: str, col: str) -> tuple[bool, int]:
    r = httpx.get(
        f"{URL}/rest/v1/{table}?select={col}&limit=1",
        headers=HEADERS,
        timeout=20,
    )
    return r.status_code == 200, r.status_code


def check_rpc(name: str, body: dict) -> tuple[bool, int, str]:
    r = httpx.post(
        f"{URL}/rest/v1/rpc/{name}",
        headers=HEADERS,
        json=body,
        timeout=20,
    )
    err = r.text[:150] if r.status_code >= 400 else ""
    return r.status_code in (200, 204), r.status_code, err


def main() -> None:
    print("=== SUPABASE VERIFICATION ===")
    print(f"Project: {URL}\n")

    table_specs: list[tuple[str, str] | tuple[list[str], str]] = [
        ("tenants", "id"),
        ("profiles", "id"),
        ("sales_data", "id"),
        ("context_cache", "id"),
        ("chat_history", "id"),
        ("audit_log", "id"),
        ("generated_reports", "id"),
        ("secondary_sales_data", "id"),
        ("scheme_master", "id"),
        ("conversations", "id"),
        ("import_jobs", "id"),
        ("invoices", "id"),
        ("invoice_sequence", "year"),
        (["payment_webhook_events", "stripe_webhook_events"], "event_id"),
        ("dunning_events", "id"),
    ]
    print("TABLES (expect all OK):")
    all_tables = True
    for spec in table_specs:
        if isinstance(spec[0], list):
            names, col = spec
            ok, code, matched = check_table_any(names, col)
            label = matched if ok else "payment_webhook_events"
        else:
            name, col = spec
            ok, code = check_table(name, col)
            matched = name
            label = name
        if not ok:
            all_tables = False
        print(f"  [{'OK' if ok else 'FAIL'}] {label} ({code})")

    print("\nCOLUMNS (expect all OK):")
    columns = [
        ("sales_data", "outstanding_amount"),
        ("chat_history", "conversation_id"),
        ("profiles", "preferences"),
        ("tenants", "billing_details"),
        ("tenants", "past_due_since"),
        ("tenants", "razorpay_customer_id"),
        ("tenants", "razorpay_subscription_id"),
        ("invoices", "provider_payment_id"),
        ("invoices", "pdf_storage_path"),
    ]
    all_cols = True
    for table, col in columns:
        ok, code = check_column(table, col)
        if not ok:
            all_cols = False
        print(f"  [{'OK' if ok else 'FAIL'}] {table}.{col} ({code})")

    print("\nRPCs (expect all OK):")
    rpcs = [
        (
            "get_kpi_summary",
            {
                "p_tenant_id": ZERO,
                "p_start_date": "2024-01-01",
                "p_end_date": "2024-12-31",
            },
        ),
        (
            "get_top_products",
            {
                "p_tenant_id": ZERO,
                "p_start_date": "2024-01-01",
                "p_end_date": "2024-12-31",
                "p_limit": 5,
            },
        ),
        (
            "get_zone_breakdown",
            {
                "p_tenant_id": ZERO,
                "p_start_date": "2024-01-01",
                "p_end_date": "2024-12-31",
            },
        ),
        ("execute_tenant_query", {"p_query": "SELECT 1 AS ok", "p_params": {}}),
        ("update_tenant_config", {"p_tenant_id": ZERO, "p_patch": {"language": "en"}}),
        ("get_scheme_leakage", {"p_tenant_id": ZERO}),
        ("get_conversations_with_counts", {"p_user_id": ZERO}),
    ]
    all_rpcs = True
    for name, body in rpcs:
        ok, code, err = check_rpc(name, body)
        if not ok:
            all_rpcs = False
        suffix = f" — {err}" if err else ""
        print(f"  [{'OK' if ok else 'FAIL'}] {name} ({code}){suffix}")

    print("\nRLS (anon should see empty tenants):")
    r = httpx.get(
        f"{URL}/rest/v1/tenants?select=id&limit=1",
        headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"},
        timeout=20,
    )
    anon_ok = r.status_code == 200 and r.json() == []
    print(f"  [{'OK' if anon_ok else 'FAIL'}] anon tenants blocked ({r.status_code})")

    print()
    migration_016 = (
        check_column("tenants", "razorpay_customer_id")[0]
        and check_column("invoices", "provider_payment_id")[0]
        and check_table("payment_webhook_events", "event_id")[0]
    )
    print(f"MIGRATION 016 (Razorpay provider): {'APPLIED' if migration_016 else 'PENDING — run 016_billing_razorpay_provider.sql'}")
    print()
    if all_tables and all_cols and all_rpcs and anon_ok and migration_016:
        print("RESULT: SUPABASE MIGRATIONS COMPLETE — ready for Railway/Vercel")
    else:
        print("RESULT: ISSUES REMAIN — see FAIL lines above")


if __name__ == "__main__":
    main()
