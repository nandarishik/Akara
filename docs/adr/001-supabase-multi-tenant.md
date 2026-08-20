# ADR 001: Supabase multi-tenant Postgres

## Status

Accepted

## Context

AKARA needs authenticated multi-tenant storage with RLS, auth, and file uploads for sales imports.

## Decision

Use Supabase (Postgres + Auth + Storage + Edge Functions) as the primary data plane. Tenant isolation via `tenant_id` columns and RLS policies.

## Consequences

- Fast auth and storage integration
- SQL analytics via guarded tenant queries
- Vendor coupling to Supabase client/RPC patterns (mitigated by service boundaries)
