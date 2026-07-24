export interface KPISummary {
  total_revenue: number;
  total_orders: number;
  unique_parties: number;
  avg_order_value: number;
  total_quantity: number;
  total_discount: number;
  // Change tracking properties
  revenue_change?: number;
  revenue_change_pct?: number;
  orders_change?: number;
  orders_change_pct?: number;
  parties_change?: number;
  parties_change_pct?: number;
  aov_change?: number;
  aov_change_pct?: number;
}

export interface TopProduct {
  product_name: string;
  total_revenue: number;
  quantity: number;
  order_count: number;
}

export interface ZoneBreakdown {
  zone: string;
  revenue: number;
  order_count: number;
  revenue_pct: number;
}

export interface RevenueByDate {
  invoice_date: string;
  revenue: number;
  orders: number;
}

export interface RoutePerformance {
  route: string;
  revenue: string;
  order_count: number;
  unique_parties: number;
  avg_order_value: string;
}

export interface OutstandingParty {
  party_name: string;
  party_zone: string | null;
  outstanding_amount: string;
  days_outstanding: number | null;
}

export interface KPIResponse {
  summary: KPISummary;
  top_products: TopProduct[];
  zone_breakdown: ZoneBreakdown[];
  revenue_trend: RevenueByDate[];
  route_performance: RoutePerformance[];
  outstanding_parties: OutstandingParty[];
  date_range_start: string;
  date_range_end: string;
  last_import?: string;
}
