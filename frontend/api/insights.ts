import { request } from '@/lib/request';
import type { Locale } from '@/lib/i18n';

export interface ReorderSuggestion {
  productId: number;
  productName: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  soldLast7Days: number;
  forecastNext14Days: number;
  forecastMethod: 'weekday-seasonal' | 'moving-average';
  suggestedReorderQty: number;
  unitCost: string;
  estimatedCost: string;
  urgency: 'critical' | 'high' | 'medium';
  reason: string;
  supplier: { id: number; name: string; phone: string | null; email: string | null } | null;
  category: { id: number; name: string } | null;
}

export interface TopSeller {
  productId: number;
  productName: string;
  sku: string | null;
  currentStock: number;
  category: { id: number; name: string } | null;
  totalSold: number;
  totalRevenue: string;
}

export interface SlowMover {
  id: number;
  name: string;
  sku: string | null;
  currentStock: number;
  minStock: number;
  sellingPrice: string;
  costPrice: string;
  expirationDate: string | null;
  stockValue: string;
  supplier: { id: number; name: string } | null;
  category: { id: number; name: string } | null;
}

export function apiGetReorderSuggestions(language: Locale) {
  return request<{ suggestions: ReorderSuggestion[]; summary: string }>(
    `/api/insights/reorder?language=${encodeURIComponent(language)}`,
  );
}

export interface GeneratedPurchaseOrderItem {
  id: number;
  productId: number;
  productName: string;
  sku: string | null;
  unit: string;
  quantity: number;
  unitCost: string;
  lineTotal: string;
}

export interface GeneratedPurchaseOrder {
  id: number;
  orderNumber: string;
  businessDate: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  estimatedTotal: string;
  supplier: {
    id: number;
    name: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  items: GeneratedPurchaseOrderItem[];
}

export interface GeneratedPurchaseOrderBatch {
  businessDate: string;
  createdCount: number;
  updatedCount: number;
  orders: GeneratedPurchaseOrder[];
}

export function apiGeneratePurchaseOrders(language: Locale) {
  return request<GeneratedPurchaseOrderBatch>(
    `/api/purchase-orders/generate-from-reorder?language=${encodeURIComponent(language)}`,
    { method: 'POST' },
  );
}

export function apiGetTopSellers() {
  return request<{ topSellers: TopSeller[] }>('/api/insights/top-sellers');
}

export function apiGetSlowMovers() {
  return request<{ slowMovers: SlowMover[]; message: string }>('/api/insights/slow-movers');
}

export type InsightAgentTool =
  | 'get_reorder_suggestions'
  | 'get_top_sellers'
  | 'get_slow_movers'
  | 'get_store_summary'
  | 'get_expiry_risks'
  | 'get_min_stock_review'
  | 'propose_purchase_orders'
  | 'propose_min_stock_change';

export interface ExpiryRisk {
  productId: number;
  productName: string;
  unit: string;
  category: { id: number; name: string } | null;
  expirationDate: string;
  daysLeft: number;
  currentStock: number;
  expectedSalesBeforeExpiry: number;
  atRiskUnits: number;
  atRiskCost: string;
  action: 'markdown' | 'remove';
  suggestedDiscountPct: number | null;
  sellingPrice: string;
  suggestedPrice: string | null;
  belowCost: boolean;
}

export function apiGetExpiryRisks(language: Locale) {
  return request<{ windowDays: number; totalAtRiskCost: string; risks: ExpiryRisk[]; summary: string }>(
    `/api/insights/expiry-risks?language=${encodeURIComponent(language)}`,
  );
}

export interface MinStockReview {
  productId: number;
  productName: string;
  unit: string;
  currentStock: number;
  currentMinStock: number;
  recommendedMinStock: number;
  direction: 'raise' | 'lower';
  averageDailyForecast: number;
  peakDailyForecast: number;
}

export function apiGetMinStockReview(language: Locale) {
  return request<{ leadTimeDays: number; reviews: MinStockReview[]; summary: string }>(
    `/api/insights/min-stock-review?language=${encodeURIComponent(language)}`,
  );
}

export interface AgentActionProposal {
  id: number;
  type: 'generate_purchase_orders' | 'set_min_stock';
  status: 'pending';
  created: boolean;
  rationale: string;
}

export function apiAskInsight(question: string, language: Locale) {
  return request<{
    question: string;
    language: Locale;
    answer: string;
    type: string;
    provider: 'openai-agent' | 'local-agent';
    toolsUsed: InsightAgentTool[];
    fallbackReason: string | null;
    proposals: AgentActionProposal[];
  }>('/api/insights/ask', {
    method: 'POST',
    body: JSON.stringify({ question, language }),
  });
}
