import { request } from '@/lib/request';

export interface PermissionOption {
  id: number;
  name: string;
}

export interface PermissionRow {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  roles: { id: number; name: string }[];
}

export interface GetPermissionsParams {
  name?: string;
  filterCodes?: string;
  filterRoles?: string;
  filterCreatedDates?: string;
  filterUpdatedDates?: string;
  sortField?: 'id' | 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetPermissionsResult {
  total: number;
  list: PermissionRow[];
  page: number;
  pageSize: number;
}

export function apiGetPermissions(params: GetPermissionsParams = {}) {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.filterCodes) query.set('filterCodes', params.filterCodes);
  if (params.filterRoles) query.set('filterRoles', params.filterRoles);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.filterUpdatedDates) query.set('filterUpdatedDates', params.filterUpdatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetPermissionsResult>(`/api/permissions${qs ? `?${qs}` : ''}`);
}

export function apiGetPermissionFilterOptions(
  field: string,
  params: Omit<GetPermissionsParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.name) query.set('name', params.name);
  if (params.filterCodes) query.set('filterCodes', params.filterCodes);
  if (params.filterRoles) query.set('filterRoles', params.filterRoles);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.filterUpdatedDates) query.set('filterUpdatedDates', params.filterUpdatedDates);
  return request<string[]>(`/api/permissions/filter-options?${query.toString()}`);
}

export function apiCreatePermission(data: { name: string; roles: string[] }) {
  return request<PermissionRow>('/api/permissions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiCheckPermissionCodeExists(name: string) {
  return apiGetPermissionFilterOptions('name', {}).then((codes) => ({
    exists: codes.includes(name),
  }));
}

export function apiGetPermissionById(id: number | string) {
  return request<PermissionRow>(`/api/permissions/${id}`);
}

export function apiUpdatePermission(id: number | string, data: { roles?: string[] }) {
  return request<PermissionRow>(`/api/permissions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeletePermission(id: number | string) {
  return request<{ success: boolean }>(`/api/permissions/${id}`, { method: 'DELETE' });
}

export async function serverGetPermissions(): Promise<PermissionOption[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${baseUrl}/api/permissions/all`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
