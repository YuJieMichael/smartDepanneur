import { request } from '@/lib/request';

export interface ProductRelationOption {
  id: number;
  name: string;
}

export interface ProductRow {
  id: number;
  name: string;
  barcode: string | null;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  costPrice: string;
  sellingPrice: string;
  expirationTracked: boolean;
  expirationDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryId: number | null;
  supplierId: number | null;
  createdById: number | null;
  category: { id: number; name: string; code: string | null } | null;
  supplier: { id: number; name: string; contactName: string | null } | null;
  createdBy: { id: number; email: string } | null;
}

export interface GetProductListParams {
  name?: string;
  filterIds?: string;
  filterNames?: string;
  filterCategories?: string;
  filterSuppliers?: string;
  filterActive?: string;
  filterCreatedDates?: string;
  sortField?: 'id' | 'name' | 'currentStock' | 'sellingPrice' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetProductListResult {
  total: number;
  list: ProductRow[];
  page: number;
  pageSize: number;
}

export interface ProductPayload {
  name: string;
  barcode?: string | null;
  sku?: string | null;
  unit?: string;
  currentStock?: number;
  minStock?: number;
  costPrice: number | string;
  sellingPrice: number | string;
  expirationTracked?: boolean;
  expirationDate?: string | null;
  isActive?: boolean;
  categoryId?: number | null;
  supplierId?: number | null;
}

export function apiGetProductList(params: GetProductListParams = {}) {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.filterIds) query.set('filterIds', params.filterIds);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterCategories) query.set('filterCategories', params.filterCategories);
  if (params.filterSuppliers) query.set('filterSuppliers', params.filterSuppliers);
  if (params.filterActive) query.set('filterActive', params.filterActive);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetProductListResult>(`/api/products/list${qs ? `?${qs}` : ''}`);
}

export function apiGetProductFilterOptions(
  field: string,
  params: Omit<GetProductListParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.name) query.set('name', params.name);
  if (params.filterIds) query.set('filterIds', params.filterIds);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterCategories) query.set('filterCategories', params.filterCategories);
  if (params.filterSuppliers) query.set('filterSuppliers', params.filterSuppliers);
  if (params.filterActive) query.set('filterActive', params.filterActive);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  return request<string[]>(`/api/products/filter-options?${query.toString()}`);
}

export function apiGetProductById(id: number | string) {
  return request<ProductRow>(`/api/products/detail/${id}`);
}

export function apiCreateProduct(data: ProductPayload) {
  return request<ProductRow>('/api/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiUpdateProduct(id: number | string, data: Partial<ProductPayload>) {
  return request<ProductRow>(`/api/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeleteProduct(id: number | string) {
  return request<{ success: boolean }>(`/api/products/${id}`, { method: 'DELETE' });
}