# AKARA Customer Onboarding Checklist

Use this checklist every time you onboard a new customer. The entire process takes under 10 minutes.

---

## Step 1: Provision Tenant

Run in the Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
INSERT INTO public.tenants (name, slug, config)
VALUES (
    'Customer Company Name',
    'customer-slug',          -- lowercase, hyphens only (used in URLs)
    '{"timezone": "Asia/Kolkata", "industry": "fmcg_distribution", "language": "en"}'
)
RETURNING id;
```

**Copy the returned `id` UUID** — you need it for the next steps.

---

## Step 2: Create Admin User in Supabase Auth

1. Go to Supabase Dashboard → Authentication → Users → Invite User
2. Enter the customer's admin email address
3. The customer receives a magic-link / invite email to set their password
4. Note the User UUID shown in the Users table after the account is created

---

## Step 3: Create Profile Row

Run in the SQL Editor (replace both UUIDs):

```sql
INSERT INTO public.profiles (id, tenant_id, role, display_name, preferences)
VALUES (
    'USER_UUID_FROM_STEP_2',
    'TENANT_UUID_FROM_STEP_1',
    'admin',
    'Admin Name',
    '{"morning_brief_enabled": true}'
);
```

Verify the profile was created:
```sql
SELECT id, tenant_id, role, display_name
FROM public.profiles
WHERE tenant_id = 'TENANT_UUID_FROM_STEP_1';
```

---

## Step 4: Send Welcome Email to Customer

Send them:
- **URL:** your Vercel/custom domain (e.g. `https://app.akara.ai`)
- **Email:** the email used in Step 2
- **Temporary password:** if you used "Invite User", they set their own password via the link. If you created a user manually, include the password securely.
- **First task:** Go to `/data` and upload your first Excel/CSV file

Template:

> Hi [Name],
>
> Your AKARA account is ready. Log in at [URL] with [email].
>
> Your first step: go to the **Data** page and upload your sales data (Excel or CSV). Once uploaded, your dashboard KPIs will populate automatically.
>
> Let us know if you need help!

---

## Step 5: Customer Uploads Data

The customer logs in and navigates to `/data`. They can upload:

| Panel | Source | Required columns |
|---|---|---|
| **Primary Sales** | Tally / ERP | `invoice_date`, `party_name`, `total_amount` |
| **Secondary Sales** | Bizom / DMS | `invoice_date`, `party_name`, `total_amount` |
| **Scheme Master** | Manual | `scheme_name`, `party_name`, `claimed_amount`, `scheme_start`, `scheme_end` |

At minimum, the customer needs to upload **Primary Sales** for the dashboard to populate.

---

## Step 6: Verify KPIs Appear

1. Have the customer navigate to `/dashboard`
2. KPI cards (Revenue, Orders, Parties, Avg Order) should populate within 3 seconds
3. If cards show 0 or an error, run:
   ```sql
   SELECT COUNT(*), MIN(invoice_date), MAX(invoice_date)
   FROM public.sales_data
   WHERE tenant_id = 'TENANT_UUID_FROM_STEP_1';
   ```
4. If count > 0 but dashboard shows nothing, check the date range picker — it defaults to last 30 days

---

## Optional: Enable Morning Brief

The morning brief is **opt-in and already enabled by default** for admin users (see `preferences` in Step 3). It fires at 7:00 AM IST via Supabase Edge Function.

To verify it's configured:
- `SENDGRID_API_KEY` must be set in Railway
- `BACKEND_SERVICE_KEY` must match in both Railway and Supabase Edge Function secrets
- Supabase → Edge Functions → `daily-morning-brief` → Schedule: `30 1 * * *`

---

## Offboarding / Data Deletion

To fully remove a customer's data:

```sql
-- Deletes all tenant data (RLS-scoped tables cascade from tenant_id)
DELETE FROM public.sales_data WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.secondary_sales_data WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.scheme_master WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.profiles WHERE tenant_id = 'TENANT_UUID';
DELETE FROM public.tenants WHERE id = 'TENANT_UUID';
```

Then delete the user from Supabase Auth → Users → Delete.

---

## Checklist Summary

- [ ] Tenant row created in `public.tenants`
- [ ] Auth user created in Supabase Auth
- [ ] Profile row created in `public.profiles` with `role = 'admin'`
- [ ] Welcome email sent with URL + credentials
- [ ] Customer uploaded at least Primary Sales data
- [ ] Dashboard KPI cards populate correctly
- [ ] Morning brief scheduled (if SendGrid configured)
