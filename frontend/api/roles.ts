import { request } from '@/lib/request';

export interface RoleOption {
  id: number;
  name: string;
  description: string | null;
}

export interface RoleRow {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: { id: number; name: string }[];
}

export interface GetRolesListParams {
  name?: string;
  filterNames?: string;
  filterPermissions?: string;
  filterCreatedDates?: string;
  filterUpdatedDates?: string;
  sortField?: 'id' | 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetRolesListResult {
  total: number;
  list: RoleRow[];
  page: number;
  pageSize: number;
}

export function apiGetRoles() {
  return request<RoleOption[]>('/api/roles');
}

export async function serverGetRoles(): Promise<RoleOption[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${baseUrl}/api/roles`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function apiGetRolesList(params: GetRolesListParams = {}) {
  const query = new URLSearchParams();
  if (params.name) query.set('name', params.name);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterPermissions) query.set('filterPermissions', params.filterPermissions);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.filterUpdatedDates) query.set('filterUpdatedDates', params.filterUpdatedDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetRolesListResult>(`/api/roles/list${qs ? `?${qs}` : ''}`);
}

export function apiGetRoleFilterOptions(
  field: string,
  params: Omit<GetRolesListParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.name) query.set('name', params.name);
  if (params.filterNames) query.set('filterNames', params.filterNames);
  if (params.filterPermissions) query.set('filterPermissions', params.filterPermissions);
  if (params.filterCreatedDates) query.set('filterCreatedDates', params.filterCreatedDates);
  if (params.filterUpdatedDates) query.set('filterUpdatedDates', params.filterUpdatedDates);
  return request<string[]>(`/api/roles/filter-options?${query.toString()}`);
}

export function apiCreateRole(data: { name: string; permissionNames: string[] }) {
  return request<RoleRow>('/api/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiCheckRoleNameExists(name: string) {
  return apiGetRoleFilterOptions('name', {}).then((names) => ({
    exists: names.includes(name),
  }));
}

export function apiGetRoleById(id: number | string) {
  return request<RoleRow>(`/api/roles/detail/${id}`);
}

export function apiUpdateRole(id: number | string, data: { name?: string; permissionNames?: string[] }) {
  return request<RoleRow>(`/api/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeleteRole(id: number | string) {
  return request<{ success: boolean }>(`/api/roles/${id}`, { method: 'DELETE' });
}
