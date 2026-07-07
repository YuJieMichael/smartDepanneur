import { request } from '@/lib/request';

export interface CategoryRow {
  id: number;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetCategoryListParams {
  name?: string;
  filterNames?: string;
  filterCodes?: string;
  filterCreatedDates?: string;
  sortField?: 'id' | 'name' | 'code' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetCategoryListResult {
  total: number;
  list: CategoryRow[];
  page: number;
  pageSize: number;
}

export interface CategoryPayload {
  name: string;
  code?: string | null;
}

export function apiGetAllCategories() {
  return request<CategoryRow[]>('/api/categories');
}

export function apiGetCategoryList(params: GetCategoryListParams = {}) {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterCodes) query.set('filterCodes', params.filterCodes);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetCategoryListResult>(`/api/categories/list${qs ? `?${qs}` : ''}`);
}

export function apiGetCategoryFilterOptions(
  field: string,
  params: Omit<GetCategoryListParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.name) query.set('name', params.name);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterCodes) query.set('filterCodes', params.filterCodes);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  return request<string[]>(`/api/categories/filter-options?${query.toString()}`);
}

export function apiGetCategoryById(id: number | string) {
  return request<CategoryRow>(`/api/categories/detail/${id}`);
}

export function apiCreateCategory(data: CategoryPayload) {
  return request<CategoryRow>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiUpdateCategory(id: number | string, data: Partial<CategoryPayload>) {
  return request<CategoryRow>(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeleteCategory(id: number | string) {
  return request<{ success: boolean }>(`/api/categories/${id}`, { method: 'DELETE' });
}