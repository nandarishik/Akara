"""Canonical SQLite schema for benchmark ground truth."""

from __future__ import annotations

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    party_type TEXT DEFAULT 'customer',
    city TEXT,
    phone TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS party_aliases (
    party_id TEXT NOT NULL REFERENCES parties(id),
    alias TEXT NOT NULL,
    PRIMARY KEY (party_id, alias)
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT DEFAULT 'pcs',
    hsn_code TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    party_id TEXT REFERENCES parties(id),
    channel TEXT,
    status TEXT DEFAULT 'ACTIVE',
    gross_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    net_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    tip_amount REAL DEFAULT 0,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices(party_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

CREATE TABLE IF NOT EXISTS sales_lines (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    line_no INTEGER NOT NULL,
    product_id TEXT REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_category TEXT,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    gross_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    net_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_lines_invoice ON sales_lines(invoice_id);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES invoices(id),
    payment_date TEXT NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    settlement_date TEXT NOT NULL,
    method TEXT NOT NULL,
    expected_amount REAL NOT NULL,
    collected_amount REAL NOT NULL,
    variance REAL DEFAULT 0,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    movement_date TEXT NOT NULL,
    product_id TEXT REFERENCES products(id),
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    reference TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    shift_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    hours REAL DEFAULT 0,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS wastage (
    id TEXT PRIMARY KEY,
    wastage_date TEXT NOT NULL,
    product_id TEXT REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_cost REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    reason TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS job_cards (
    id TEXT PRIMARY KEY,
    job_number TEXT NOT NULL,
    job_date TEXT NOT NULL,
    party_id TEXT REFERENCES parties(id),
    vehicle_reg TEXT,
    vehicle_make TEXT,
    status TEXT DEFAULT 'COMPLETED',
    mechanic_id TEXT REFERENCES employees(id),
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS estimates (
    id TEXT PRIMARY KEY,
    estimate_number TEXT NOT NULL,
    estimate_date TEXT NOT NULL,
    party_id TEXT REFERENCES parties(id),
    job_card_id TEXT REFERENCES job_cards(id),
    estimated_amount REAL NOT NULL,
    final_invoice_id TEXT REFERENCES invoices(id),
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS vendor_purchases (
    id TEXT PRIMARY KEY,
    purchase_date TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    product_id TEXT REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    total_cost REAL NOT NULL,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS parts_inventory (
    product_id TEXT PRIMARY KEY REFERENCES products(id),
    quantity_on_hand REAL NOT NULL,
    unit_cost REAL NOT NULL,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS insurance_claims (
    id TEXT PRIMARY KEY,
    job_card_id TEXT REFERENCES job_cards(id),
    invoice_id TEXT REFERENCES invoices(id),
    insurer TEXT NOT NULL,
    claim_amount REAL NOT NULL,
    approved_amount REAL,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS medicine_batches (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),
    batch_no TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    mrp REAL NOT NULL,
    ptr REAL NOT NULL,
    quantity REAL NOT NULL,
    schedule TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    purchase_date TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    product_id TEXT REFERENCES products(id),
    batch_id TEXT REFERENCES medicine_batches(id),
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    total_cost REAL NOT NULL,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS returns (
    id TEXT PRIMARY KEY,
    return_date TEXT NOT NULL,
    original_invoice_id TEXT REFERENCES invoices(id),
    original_line_id TEXT REFERENCES sales_lines(id),
    product_id TEXT REFERENCES products(id),
    quantity REAL NOT NULL,
    refund_amount REAL NOT NULL,
    return_type TEXT DEFAULT 'RETURN',
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS doctor_referrals (
    id TEXT PRIMARY KEY,
    referral_date TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    party_id TEXT REFERENCES parties(id),
    invoice_id TEXT REFERENCES invoices(id),
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS pharmacist_shifts (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    shift_date TEXT NOT NULL,
    hours REAL NOT NULL,
    bills_count INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS delivery_log (
    id TEXT PRIMARY KEY,
    delivery_date TEXT NOT NULL,
    invoice_id TEXT REFERENCES invoices(id),
    party_id TEXT REFERENCES parties(id),
    delivery_fee REAL DEFAULT 0,
    metadata TEXT
);
"""
