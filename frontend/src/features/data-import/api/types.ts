/** Phase 6 café import wire types — snake_case matches DEV1 HTTP contract. */

export type CafeImportType = "cafe_orders" | "cafe_expenses" | "cafe_inventory";

export type MappingBand = "accepted" | "suggested" | "uncertain" | "unmapped";

export type CafeFlags = {
  cafe_import: boolean;
  ai_mapping: boolean;
  quarantine_ui: boolean;
  max_upload_bytes: number;
};

export type MappingColumn = {
  raw_column: string;
  canonical_field: string | null;
  confidence: number | null;
  band: MappingBand;
  sample_values: string[];
};

export type MappingProposal = {
  import_id: string;
  import_type: CafeImportType;
  status: string;
  ai_mapping_used: boolean;
  ai_mapping_confidence: number | null;
  columns: MappingColumn[];
  required_fields: string[];
  unmapped_required: string[];
};

export type MappingConfirmBody = {
  mappings: { raw_column: string; canonical_field: string }[];
};

export type MappingConfirmResponse = {
  import_id: string;
  status: string;
};

export type CafeUploadResponse = {
  import_id: string;
  status: string;
  import_type: CafeImportType;
};

export type CafeSkippedResponse = {
  status: "skipped";
  existing_import_id: string;
};

export type ImportStatus = {
  import_id: string;
  status: string;
  import_type: CafeImportType | string;
  last_completed_batch: number;
  total_batches: number;
  progress_pct: number;
  canonical_row_count: number;
  quarantine_row_count: number;
  error_message: string | null;
};

export type ChannelBreakdown = {
  channel: string;
  order_count: number;
  total_amount: number;
  pct: number;
};

export type FailureTypeCount = {
  failure_type: string;
  canonical_field: string | null;
  count: number;
  example_reason: string;
};

export type Reconciliation = {
  import_id: string;
  order_count: number;
  total_amount: number;
  currency: string;
  date_range_start: string | null;
  date_range_end: string | null;
  span_days: number;
  span_alert: boolean;
  channels: ChannelBreakdown[];
  quarantine_row_count: number;
  top_failure_types: FailureTypeCount[];
  totals_delta_pct: number;
  totals_flag: boolean;
  reconciliation_confirmed: boolean;
  reconciliation_notes: string | null;
};

export type ReconciliationConfirmBody = {
  accepted: boolean;
  notes?: string | null;
  action?: "undo" | "accept_rounding" | "contact_support";
};

export type QuarantineRow = {
  id: string;
  row_number: number;
  failure_type: string;
  failure_reason: string;
  canonical_field: string | null;
  raw_row: Record<string, unknown>;
  resolved: boolean;
};

export type QuarantineList = {
  rows: QuarantineRow[];
  unresolved_count: number;
};

export type CafeLocation = {
  location_id: string;
  location_name: string;
  city: string | null;
  state_code: string | null;
  is_active: boolean;
};

export type LocationCreate = {
  location_name: string;
  address?: string | null;
  city?: string | null;
  state_code?: string | null;
  gstin?: string | null;
  fssai_number?: string | null;
};

export type CafeChannel = {
  channel_id: string;
  channel_name: string;
  channel_type: string;
  commission_rate: number;
  is_active: boolean;
};

export type ChannelUpsert = {
  channel_name: string;
  channel_type: string;
  commission_rate: number;
};

export type DataQuality = {
  last_import_at: string | null;
  coverage_days: number;
  completeness_pct: number;
  quarantine_unresolved: number;
  channels_mapped: number;
  channels_total: number;
};

export const ORDER_CANONICAL_FIELDS = [
  "order_time",
  "external_order_id",
  "aggregator_order_id",
  "channel",
  "order_type",
  "status",
  "staff_name",
  "table_id",
  "covers",
  "subtotal_amount",
  "discount_amount",
  "tax_amount",
  "service_charge",
  "packaging_charge",
  "delivery_charge",
  "total_amount",
  "payment_method",
  "payment_reference",
  "closed_time",
] as const;

export const EXPENSE_CANONICAL_FIELDS = [
  "expense_date",
  "category",
  "sub_category",
  "description",
  "amount",
  "vendor_name",
  "invoice_number",
] as const;

export const INVENTORY_CANONICAL_FIELDS = [
  "item_name",
  "sku",
  "barcode",
  "category",
  "unit",
  "quantity",
  "reorder_point",
  "reorder_quantity",
  "cost_per_unit",
  "supplier_name",
] as const;

export const IMPORT_ID_STORAGE_KEY = "akara.p06.import_id";
