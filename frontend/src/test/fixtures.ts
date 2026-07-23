/**
 * Frontend test fixtures — mirror backend/tests/conftest.py
 * Used by unit tests and Playwright E2E seed scenarios.
 */

export const FIXTURE_IDS = {
  TENANT_FREE: "11111111-0000-0000-0000-000000000001",
  TENANT_PRO: "22222222-0000-0000-0000-000000000002",
  TENANT_BUSINESS: "33333333-0000-0000-0000-000000000003",
  TENANT_PAST_DUE: "44444444-0000-0000-0000-000000000004",
  TENANT_TRIAL: "55555555-0000-0000-0000-000000000005",
  TENANT_EMPTY: "66666666-0000-0000-0000-000000000006",
  USER_SUPERADMIN: "00000000-aaaa-0000-0000-000000000001",
} as const;

export const FIXTURES = {
  FREE: {
    plan: "free" as const,
    plan_status: "active" as const,
    copilot_calls_used: 9,
    copilot_calls_limit: 10,
  },
  PRO: {
    plan: "pro" as const,
    plan_status: "active" as const,
  },
  BUSINESS: {
    plan: "business" as const,
    plan_status: "active" as const,
  },
  PAST_DUE: {
    plan: "pro" as const,
    plan_status: "past_due" as const,
  },
  TRIAL: {
    plan: "pro" as const,
    plan_status: "trialing" as const,
    trial_days_remaining: 13,
  },
  EMPTY: {
    plan: "pro" as const,
    plan_status: "active" as const,
    rows_imported: 0,
  },
  SUPERADMIN: {
    plan: "business" as const,
    plan_status: "active" as const,
    is_superadmin: true,
  },
} as const;
