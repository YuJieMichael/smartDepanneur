import { request } from '@/lib/request';

export interface DictionaryItem {
  id: number;
  key: string;
  value: string[];
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryRow {
  id: number;
  key: string;
  value: string[];
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetDictionaryListParams {
  key?: string;
  filterKeys?: string;
  filterCategories?: string;
  filterCreatedDates?: string;
  filterUpdatedDates?: string;
  sortField?: 'id' | 'key' | 'category' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetDictionaryListResult {
  total: number;
  list: DictionaryRow[];
  page: number;
  pageSize: number;
}

export async function serverGetAllDictionaries(): Promise<DictionaryItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${baseUrl}/api/dictionary`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function apiGetDictionaryByKey(key: string): Promise<DictionaryItem | null> {
  return request<DictionaryItem>(`/api/dictionary/${encodeURIComponent(key)}`);
}

export async function apiGetDictionariesByCategory(category: string): Promise<DictionaryItem[]> {
  return request<DictionaryItem[]>(`/api/dictionary?category=${encodeURIComponent(category)}`);
}

export function apiGetDictionaryList(params: GetDictionaryListParams = {}) {
  const query = new URLSearchParams();
  if (params.key) query.set('key', params.key);
  if (params.filterKeys) query.set('filterKeys', params.filterKeys);
  if (params.filterCategories) query.set('filterCategories', params.filterCategories);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.filterUpdatedDates) query.set('filterUpdatedDates', params.filterUpdatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetDictionaryListResult>(`/api/dictionary/list${qs ? `?${qs}` : ''}`);
}

export function apiGetDictionaryFilterOptions(
  field: string,
  params: Omit<GetDictionaryListParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.key) query.set('key', params.key);
  if (params.filterKeys) query.set('filterKeys', params.filterKeys);
  if (params.filterCategories) query.set('filterCategories', params.filterCategories);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.filterUpdatedDates) query.set('filterUpdatedDates', params.filterUpdatedDates);
  return request<string[]>(`/api/dictionary/filter-options?${query.toString()}`);
}

export function apiCreateDictionary(data: { key: string; value: string[]; category?: string }) {
  return request<DictionaryRow>('/api/dictionary', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiCheckDictionaryKeyExists(key: string) {
  return apiGetDictionaryFilterOptions('key', {}).then((keys) => ({
    exists: keys.includes(key),
  }));
}

export function apiGetDictionaryById(id: number | string) {
  return request<DictionaryRow>(`/api/dictionary/detail/${id}`);
}

export function apiUpdateDictionary(id: number | string, data: { key?: string; value?: string[]; category?: string }) {
  return request<DictionaryRow>(`/api/dictionary/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeleteDictionary(id: number | string) {
  return request<{ success: boolean }>(`/api/dictionary/${id}`, { method: 'DELETE' });
}
