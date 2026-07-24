"""Apply a Supabase SQL migration via direct Postgres connection.

Usage:
    cd akara/backend
    # Set SUPABASE_DB_URL in .env (Dashboard → Database → Connection string URI)
    python scripts/apply_migration.py ../supabase/migrations/016_billing_razorpay_provider.sql

Requires SUPABASE_DB_URL or SUPABASE_POOLER_URL in backend/.env.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

from app.core.config import settings


async def apply_sql(path: Path) -> None:
    url = settings.postgres_url
    if not url:
        print(
            "ERROR: Set SUPABASE_DB_URL or SUPABASE_POOLER_URL in backend/.env "
            "(Supabase Dashboard → Settings → Database → Connection string)."
        )
        sys.exit(1)

    sql = path.read_text(encoding="utf-8")
    print(f"Applying {path.name} to Postgres...")
    conn = await asyncpg.connect(url, command_timeout=120)
    try:
        await conn.execute(sql)
    finally:
        await conn.close()
    print(f"Done: {path.name}")


def main() -> None:
    load_dotenv()
    if len(sys.argv) != 2:
        print("Usage: python scripts/apply_migration.py <path-to.sql>")
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"File not found: {path}")
        sys.exit(1)
    asyncio.run(apply_sql(path))


if __name__ == "__main__":
    main()
