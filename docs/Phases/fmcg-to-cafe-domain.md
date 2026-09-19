# FMCG → café domain mapping (Phase 2 — planning only)

**Do not rename columns, parsers, or prompts in Phase 2.** Physical names stay FMCG-shaped until the semantic layer (later) and any Phase 6 rename programme.

Source of truth: [`backend/app/infra/schema/columns.py`](../../backend/app/infra/schema/columns.py)  
Discovery prompt aliases: [`backend/app/infra/schema/discovery.py`](../../backend/app/infra/schema/discovery.py) lines 193–200 (and surrounding schema prompt builder).

Date: 2026-09-19  
Branch: `phase/02-dev-2-modular-foundation`

## Physical columns (`sales_data`)

| Physical column | Semantic role constant | Café / hospitality reading |
|---|---|---|
| `invoice_date` | `COL_DATE` | Order / bill date |
| `invoice_number` | `COL_INVOICE` | Bill / order / ticket id (`COUNT DISTINCT` for order counts) |
| `party_name` | `COL_PARTY` | Customer (or guest / account) |
| `party_city` | `COL_CITY` | Customer city / delivery locality |
| `party_zone` | `COL_ZONE` | Zone / area |
| `route` | — | Channel: dine-in / delivery / aggregator / OTC (see discovery aliases) |
| `product_name` | `COL_PRODUCT` | Menu item / SKU / service line |
| `product_group` | — | Parts / labour / line type (**not** category) |
| `product_category` | — | Category taxonomy |
| `hsn_code` | — | Tax HSN (GST) |
| `quantity` | `COL_QUANTITY` | Units sold |
| `gross_amount` / `discount_amount` / `net_amount` / `tax_amount` / `total_amount` | `COL_REVENUE` → `total_amount` | Money columns; prefer `COALESCE(net_amount, total_amount)` in prompts |

Companion table `tenant_companion_data` also uses `party_name`, `product_name`, `amount`, `quantity` for wastage/shifts/etc.

## Discovery semantic aliases (must not rename early)

Cited from `discovery.py` (user terms → columns):

- order channel / dine-in / delivery / aggregator / OTC / insurance → `route`
- parts / labour / spare / line type → `product_group` (NOT `product_category`)
- menu item / medicine / spare part / service line → `product_name`
- bill / order / invoice / job → `invoice_number`
- customer / patient / vehicle owner → `party_name`

## Rule for later phases

- Semantic layer maps café vocabulary → these physical names.
- Renaming physical columns before that layer breaks parsers, SQL templates, and stored prompts.
- Phase 2 only records this map; **no edits** under `backend/app/infra/schema/`.
