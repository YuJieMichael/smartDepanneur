import { request } from '@/lib/request';

export interface SupplierRow {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetSupplierListParams {
  name?: string;
  filterNames?: string;
  filterContactNames?: string;
  filterEmails?: string;
  filterCreatedDates?: string;
  sortField?: 'id' | 'name' | 'contactName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetSupplierListResult {
  total: number;
  list: SupplierRow[];
  page: number;
  pageSize: number;
}

export interface SupplierPayload {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export function apiGetAllSuppliers() {
  return request<SupplierRow[]>('/api/suppliers');
}

export function apiGetSupplierList(params: GetSupplierListParams = {}) {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterContactNames) query.set('filterContactNames', params.filterContactNames);
  if (params.filterEmails) query.set('filterEmails', params.filterEmails);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetSupplierListResult>(`/api/suppliers/list${qs ? `?${qs}` : ''}`);
}

export function apiGetSupplierFilterOptions(
  field: string,
  params: Omit<GetSupplierListParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.name) query.set('name', params.name);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterContactNames) query.set('filterContactNames', params.filterContactNames);
  if (params.filterEmails) query.set('filterEmails', params.filterEmails);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  return request<string[]>(`/api/suppliers/filter-options?${query.toString()}`);
}

export function apiGetSupplierById(id: number | string) {
  return request<SupplierRow>(`/api/suppliers/detail/${id}`);
}

export function apiCreateSupplier(data: SupplierPayload) {
  return request<SupplierRow>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiUpdateSupplier(id: number | string, data: Partial<SupplierPayload>) {
  return request<SupplierRow>(`/api/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeleteSupplier(id: number | string) {
  return request<{ success: boolean }>(`/api/suppliers/${id}`, { method: 'DELETE' });
}