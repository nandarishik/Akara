# AKARA — Canonical Plan Catalog (Phase 2)

**This is the single source of truth for plan limits.** The backend
`plan_limits.py` module (Day 2) must match this specification.
Stripe Price IDs map to these plan slugs. Do NOT change slugs without
updating Stripe, the database, and the frontend simultaneously.

---

## Plan slugs

| Slug | Display name | Stripe product |
|------|-------------|----------------|
| `free` | Free | — (no payment) |
| `pro` | Pro | `prod_pro_akara` |
| `business` | Business | `prod_business_akara` |

## Pricing (INR, inclusive of 18% GST)

| Plan | Monthly | Annual (save 20%) |
|------|---------|-------------------|
| Free | ₹0 | ₹0 |
| Pro | ₹7,999 | ₹76,790 (₹6,399.17/mo) |
| Business | ₹13,999 | ₹1,34,390 (₹11,199.17/mo) |

> **Note:** Prices are displayed tax-inclusive to Indian users. GST (18%) is
> itemised on the invoice. NEFT/manual payment is available for Business plan.

---

## Feature limits matrix

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| **Users / seats** | 1 | 3 | 10 |
| **Copilot questions / month** | 10 | 400 | 800 |
| **Rows stored (total)** | 10,000 | 500,000 | 2,000,000 |
| **Uploads / month** | 5 | Unlimited | Unlimited |
| **Uploads / day** | 3 | 3 | 3 |
| **Data undos / day** | 2 | 2 | 2 |
| **Data retention** | 30 days | 12 months | 36 months |
| **Weekly debrief** | 1 (lifetime) | Every Monday | Every Monday |
| **Morning brief** | No | Yes | Yes |
| **Scheme leakage** | No | No | Yes |
| **Simulator + Reports** | No | Yes | Yes |
| **Secondary sales + scheme import** | No | Yes | Yes |
| **API push** | No | Yes | Yes |
| **Tally connector** | No | No | Yes |
| **Team invites** | No | Yes (up to 3) | Yes (up to 10) |
| **API keys** | No | No | Yes |
| **WhatsApp delivery** | No | Yes | Yes |

---

## Retention policy

| Plan | Retention window |
|------|------------------|
| Free | 30 days |
| Pro | 365 days (12 months) |
| Business | 1,095 days (36 months) |

Enforced by `app/tasks/retention_cleanup.py` (nightly cron). Data is deleted
server-side based on `tenants.plan`; downgrade does not delete data immediately
— query filters apply instead.

---

## Trial policy

- All new tenants start on a **14-day Free Trial of Pro**.
- Trial ends → automatic downgrade to Free if no payment.
- Trial banner shown from Day 0; upgrade nudge at Day 7.
- No credit card required to start trial.

---

## Quota warning thresholds

| Threshold | Action |
|-----------|--------|
| 80% | In-app banner (amber) |
| 90% | Critical banner (red) |
| 100% | Hard block + HTTP 402; upgrade prompt |

---

## Dunning schedule (payment failure)

| Day | Action |
|-----|--------|
| 0 | Payment failed email (E5) + WhatsApp |
| 3 | Reminder email |
| 7 | Final warning email (E7) + downgrade to Free |
| 14 | Account locked (read-only access) |

---

## Downgrade behaviour

1. Seats above the new plan's limit: oldest-joined members lose access first.
   Admin is always preserved.
2. Copilot quota: immediately enforced; no mid-request truncation.
3. Scheme leakage / simulator / API: instant feature gate via `plan_guard.py`.
4. Data history: data is NOT deleted on downgrade. Retention filter applies
   server-side; data preserved if user upgrades again.

---

## LLM cost assumptions (margin planning)

| Plan | Est. LLM cost / month | Gross margin |
|------|----------------------|--------------|
| Free | ~₹28 lifetime | — |
| Pro | ~₹832 | ~87% |
| Business | ~₹1,632 | ~88% |

Model: `openai/gpt-4o-mini-2024-07-18` via OpenRouter (date-pinned).

---

*Last reviewed: Sprint Phase 2 Day 2*
*Next review: After Day 5 Stripe integration (verify Price IDs match)*
