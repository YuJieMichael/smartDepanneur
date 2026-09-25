import { request } from '@/lib/request';

export interface SaleItemRow {
  id: number;
  quantity: number;
  unitPrice: string;
  unitCost: string | null;
  lineTotal: string;
  productId: number;
  product: {
    id: number;
    name: string;
    sku: string | null;
    barcode: string | null;
  };
}

export interface SaleRow {
  id: number;
  saleNumber: string;
  subtotal: string;
  tax: string;
  total: string;
  profitEstimate: string | null;
  paymentMethod: 'cash' | 'debit' | 'credit' | 'other';
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  cashierId: number | null;
  cashier: { id: number; email: string } | null;
  voidedById: number | null;
  voidedBy: { id: number; email: string } | null;
  voidApprovedById: number | null;
  voidApprovedBy: { id: number; email: string } | null;
  voidPolicy: {
    canVoid: boolean;
    restriction: 'already_voided' | 'not_own_sale' | 'window_expired' | null;
    requiresOwnerApproval: boolean;
    windowEndsAt: string | null;
    largeVoidThreshold: string;
  };
  items: SaleItemRow[];
}

export interface DailySummary {
  date: string;
  saleCount: number;
  totalRevenue: string;
  totalProfit: string;
  topSellers: Array<{
    productId: number;
    productName: string;
    quantitySold: number;
    revenue: string;
  }>;
}

export interface GetSaleListParams {
  filterPaymentMethods?: string;
  filterCreatedDates?: string;
  sortField?: 'id' | 'saleNumber' | 'total' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetSaleListResult {
  total: number;
  list: SaleRow[];
  page: number;
  pageSize: number;
}

export interface CreateSalePayload {
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice?: number | string | null;
  }>;
  paymentMethod?: 'cash' | 'debit' | 'credit' | 'other';
  taxRate?: number;
}

export function apiGetSaleList(params: GetSaleListParams = {}) {
  const query = new URLSearchParams();
  if (params.filterPaymentMethods) query.set('filterPaymentMethods', params.filterPaymentMethods);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetSaleListResult>(`/api/sales/list${qs ? `?${qs}` : ''}`);
}

export function apiGetSaleById(id: number | string) {
  return request<SaleRow>(`/api/sales/${id}`);
}

export function apiGetDailySummary(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<DailySummary>(`/api/sales/summary/daily${qs}`);
}

export function apiCreateSale(data: CreateSalePayload) {
  return request<SaleRow>('/api/sales', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiGetRecentSales(limit = 10) {
  return request<SaleRow[]>(`/api/sales/recent?limit=${limit}`);
}

export type VoidReasonCode =
  | 'wrong_item'
  | 'wrong_quantity'
  | 'duplicate_sale'
  | 'customer_cancelled'
  | 'payment_error'
  | 'other';

export interface VoidSalePayload {
  reason: VoidReasonCode;
  ownerEmail?: string;
  ownerPassword?: string;
}

export function apiVoidSale(id: number, data: VoidSalePayload) {
  return request<SaleRow>(`/api/sales/${id}/void`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
