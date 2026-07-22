"""Create the first AKARA tenant, Supabase auth user, and admin profile.

Usage (from backend/):
  uv run python scripts/bootstrap_admin.py --email you@example.com --password 'YourPassword123'

Optional:
  --name "Company Name"   tenant display name (default: AKARA Demo)
  --slug demo             tenant slug (default: demo)
"""
from __future__ import annotations

import argparse
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"Missing {name} in backend/.env", file=sys.stderr)
        sys.exit(1)
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap first AKARA admin user")
    parser.add_argument("--email", required=True, help="Admin login email")
    parser.add_argument("--password", required=True, help="Admin login password (min 6 chars)")
    parser.add_argument("--name", default="AKARA Demo", help="Tenant display name")
    parser.add_argument("--slug", default="demo", help="Tenant slug")
    args = parser.parse_args()

    if len(args.password) < 6:
        print("Password must be at least 6 characters", file=sys.stderr)
        sys.exit(1)

    url = require_env("SUPABASE_URL").rstrip("/")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=30) as client:
        existing = client.get(
            f"{url}/rest/v1/tenants?slug=eq.{args.slug}&select=id",
            headers=headers,
        )
        if existing.status_code == 200 and existing.json():
            tenant_id = existing.json()[0]["id"]
            print(f"Using existing tenant: {tenant_id}")
        else:
            tenant_resp = client.post(
                f"{url}/rest/v1/tenants",
                headers={**headers, "Prefer": "return=representation"},
                json={
                    "name": args.name,
                    "slug": args.slug,
                    "config": {
                        "timezone": "Asia/Kolkata",
                        "industry": "fmcg_distribution",
                        "language": "en",
                    },
                },
            )
            if tenant_resp.status_code not in (200, 201):
                print(
                    f"Failed to create tenant: {tenant_resp.status_code} {tenant_resp.text}"
                )
                sys.exit(1)
            tenant_id = tenant_resp.json()[0]["id"]
            print(f"Tenant created: {tenant_id}")

        user_resp = client.post(
            f"{url}/auth/v1/admin/users",
            headers=headers,
            json={
                "email": args.email,
                "password": args.password,
                "email_confirm": True,
                "user_metadata": {
                    "tenant_id": tenant_id,
                    "role": "admin",
                    "display_name": args.email.split("@")[0],
                },
            },
        )
        if user_resp.status_code not in (200, 201):
            print(f"Failed to create auth user: {user_resp.status_code} {user_resp.text}")
            sys.exit(1)
        user_id = user_resp.json()["id"]
        print(f"Auth user created: {user_id}")
        print("Profile created automatically via on_auth_user_created trigger.")

    print("\nBootstrap complete. Sign in at your Vercel URL with:")
    print(f"  Email:    {args.email}")
    print(f"  Password: (the password you passed to this script)")


if __name__ == "__main__":
    main()
