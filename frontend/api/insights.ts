import { request } from '@/lib/request';

export interface ReorderSuggestion {
  productId: number;
  productName: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  soldLast7Days: number;
  suggestedReorderQty: number;
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

export function apiGetReorderSuggestions() {
  return request<{ suggestions: ReorderSuggestion[]; summary: string }>('/api/insights/reorder');
}

export function apiGetTopSellers() {
  return request<{ topSellers: TopSeller[] }>('/api/insights/top-sellers');
}

export function apiGetSlowMovers() {
  return request<{ slowMovers: SlowMover[]; message: string }>('/api/insights/slow-movers');
}

export function apiAskInsight(question: string) {
  return request<{
    question: string;
    answer: string;
    type: string;
    provider: 'openai' | 'local-fallback';
    fallbackReason: string | null;
  }>('/api/insights/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
