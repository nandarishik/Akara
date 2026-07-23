# AKARA — Canonical Plan Catalog (Phase 2)

**This is the single source of truth for plan limits.** The backend
`plan_limits.py` module (Day 2) must import from this specification.
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

| Plan | Monthly | Annual (2 months free) |
|------|---------|------------------------|
| Free | ₹0 | ₹0 |
| Pro | ₹2,499 | ₹24,990 (₹2,082.50/mo) |
| Business | ₹5,999 | ₹59,990 (₹4,999.17/mo) |

> **Note:** Prices are displayed tax-inclusive to Indian users. GST (18%) is
> itemised on the invoice. NEFT/manual payment is available for Business plan.

---

## Feature limits matrix

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| **Users / seats** | 1 | 5 | 15 |
| **Copilot questions / month** | 10 | 200 | Unlimited |
| **Rows imported / month** | 50,000 | 500,000 | Unlimited |
| **File uploads / day** | 1 | 5 | 20 |
| **Data history** | 90 days | 1 year | Unlimited |
| **Undo imports / day** | 1 | 5 | Unlimited |
| **Saved reports** | 3 | 25 | Unlimited |
| **Custom alerts** | 0 | 5 | Unlimited |
| **Weekly debrief** | Lifetime 3 (Free preview) | Yes | Yes |
| **Morning brief** | No | Yes | Yes |
| **Scheme leakage** | No | Yes | Yes |
| **Simulator** | No | Yes | Yes |
| **API access** | No | No | Yes |
| **Team invites** | No | Yes | Yes |
| **Priority support** | No | No | Yes |
| **WhatsApp delivery** | No | Yes | Yes |
| **Export (CSV/PDF)** | No | Yes | Yes |

---

## Trial policy

- All new tenants start on a **14-day Free Trial of Pro**.
- Trial ends → automatic downgrade to Free if no payment.
- Trial banner shown from Day 0; upgrade nudge at Day 7.
- No credit card required to start trial.

---

## Quota limits (enforced by `plan_guard.py`, Day 2)

These are the values the backend enforces. The frontend may display them but
must not be the enforcement layer.

```python
PLAN_LIMITS = {
    "free": {
        "max_seats": 1,
        "copilot_calls_per_month": 10,
        "rows_per_month": 50_000,
        "uploads_per_day": 1,
        "undo_per_day": 1,
        "saved_reports": 3,
        "alerts": 0,
        "weekly_debrief_lifetime": 3,
        "data_history_days": 90,
        "features": [],
    },
    "pro": {
        "max_seats": 5,
        "copilot_calls_per_month": 200,
        "rows_per_month": 500_000,
        "uploads_per_day": 5,
        "undo_per_day": 5,
        "saved_reports": 25,
        "alerts": 5,
        "weekly_debrief_lifetime": None,   # unlimited
        "data_history_days": 365,
        "features": [
            "scheme_leakage",
            "simulator",
            "morning_brief",
            "weekly_debrief",
            "api_access_no",               # not yet unlocked on Pro
            "team_invites",
            "whatsapp",
            "export",
        ],
    },
    "business": {
        "max_seats": 15,
        "copilot_calls_per_month": None,   # unlimited
        "rows_per_month": None,            # unlimited
        "uploads_per_day": 20,
        "undo_per_day": None,              # unlimited
        "saved_reports": None,             # unlimited
        "alerts": None,                    # unlimited
        "weekly_debrief_lifetime": None,   # unlimited
        "data_history_days": None,         # unlimited
        "features": [
            "scheme_leakage",
            "simulator",
            "morning_brief",
            "weekly_debrief",
            "api_access",
            "team_invites",
            "whatsapp",
            "export",
            "priority_support",
        ],
    },
}
```

---

## Quota warning thresholds

| Threshold | Action |
|-----------|--------|
| 80% | In-app banner (yellow) |
| 90% | Toast + email notification |
| 100% | Hard block + upgrade prompt; no silent drop |

---

## Dunning schedule (payment failure)

| Day | Action |
|-----|--------|
| 0 | Payment failed email (E6) + WhatsApp |
| 3 | Reminder email |
| 7 | Final warning email (E7) + downgrade to Free |
| 14 | Account locked (read-only access) |

---

## Downgrade behaviour

1. Seats above the new plan's limit: oldest-joined members lose access first.
   Admin is always preserved.
2. Saved reports above limit: oldest reports archived (not deleted), marked
   `archived = true`. User can still see them but cannot create new ones.
3. Copilot quota: immediately enforced; no mid-request truncation.
4. Scheme leakage / simulator / API: instant feature gate; existing reports
   remain readable but the feature is gated.
5. Data history: data is NOT deleted on downgrade. The query filter is
   applied server-side so the data is preserved if the user upgrades again.

---

*Last reviewed: Day 1 Sprint Phase 2*
*Next review: After Day 5 Stripe integration (verify Price IDs match)*
