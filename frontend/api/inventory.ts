import { request } from '@/lib/request';

export interface InventoryMovementRow {
  id: number;
  type: 'purchase' | 'adjustment' | 'sale' | 'waste' | 'expired' | 'return_item';
  quantity: number;
  unitCost: string | null;
  reason: string | null;
  referenceType: string | null;
  referenceId: number | null;
  createdAt: string;
  productId: number;
  userId: number | null;
  product: {
    id: number;
    name: string;
    sku: string | null;
    barcode: string | null;
    currentStock: number;
  };
  user: {
    id: number;
    email: string;
  } | null;
}

export interface LowStockProductRow {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  currentStock: number;
  minStock: number;
  supplier: { id: number; name: string } | null;
  category: { id: number; name: string } | null;
}

export interface ExpirationAlertRow {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  currentStock: number;
  expirationDate: string;
  daysUntilExpiration: number;
  status: 'expired' | 'expiring_soon';
  supplier: { id: number; name: string } | null;
  category: { id: number; name: string } | null;
}

export interface GetInventoryMovementListParams {
  productName?: string;
  filterTypes?: string;
  filterProductNames?: string;
  filterCreatedDates?: string;
  sortField?: 'id' | 'type' | 'quantity' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetInventoryMovementListResult {
  total: number;
  list: InventoryMovementRow[];
  page: number;
  pageSize: number;
}

export interface StockInPayload {
  productId: number;
  quantity: number;
  unitCost?: number | string | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}

export interface AdjustStockPayload {
  productId: number;
  quantity: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}

export interface WasteStockPayload {
  productId: number;
  quantity: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}

export function apiGetInventoryMovementList(params: GetInventoryMovementListParams = {}) {
  const query = new URLSearchParams();
  if (params.productName) query.set('productName', params.productName);
  if (params.filterTypes) query.set('filterTypes', params.filterTypes);
  if (params.filterProductNames) query.set('filterProductNames', params.filterProductNames);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetInventoryMovementListResult>(`/api/inventory/movements${qs ? `?${qs}` : ''}`);
}

export function apiGetInventoryFilterOptions(
  field: string,
  params: Omit<GetInventoryMovementListParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.productName) query.set('productName', params.productName);
  if (params.filterTypes) query.set('filterTypes', params.filterTypes);
  if (params.filterProductNames) query.set('filterProductNames', params.filterProductNames);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  return request<string[]>(`/api/inventory/filter-options?${query.toString()}`);
}

export function apiStockIn(data: StockInPayload) {
  return request<InventoryMovementRow>('/api/inventory/stock-in', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiAdjustStock(data: AdjustStockPayload) {
  return request<InventoryMovementRow>('/api/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiWasteStock(data: WasteStockPayload) {
  return request<InventoryMovementRow>('/api/inventory/waste', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiGetLowStockProducts() {
  return request<LowStockProductRow[]>('/api/inventory/low-stock');
}

export function apiGetExpirationAlerts(days = 7) {
  return request<ExpirationAlertRow[]>(`/api/inventory/expiration-alerts?days=${days}`);
}
