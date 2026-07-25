"""Apply 020_tenant_companion_data.sql when SUPABASE_DB_URL is set."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "020_tenant_companion_data.sql"


def main() -> int:
    load_dotenv(ROOT / "backend" / ".env")
    url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    if not url:
        print("SUPABASE_DB_URL not set — skip migration apply")
        return 0

    import psycopg2

    sql = MIGRATION.read_text(encoding="utf-8")
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    cur.execute("SELECT to_regclass('public.tenant_companion_data')")
    reg = cur.fetchone()[0]
    cur.close()
    conn.close()
    print(f"Migration applied: tenant_companion_data -> {reg}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
