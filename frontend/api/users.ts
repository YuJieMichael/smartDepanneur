import { request } from '@/lib/request';

export interface UserRow {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
  roles: { id: number; name: string }[];
}

export interface GetUsersParams {
  email?: string;
  filterIds?: string;
  filterEmails?: string;
  filterRoles?: string;
  filterDates?: string;
  sortField?: 'id' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetUsersResult {
  total: number;
  list: UserRow[];
  page: number;
  pageSize: number;
}

export function apiGetUsers(params: GetUsersParams = {}) {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.filterIds) query.set('filterIds', params.filterIds);
  if (params.filterEmails) query.set('filterEmails', params.filterEmails);
  if (params.filterRoles) query.set('filterRoles', params.filterRoles);
  if (params.filterDates) query.set('filterDates', params.filterDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetUsersResult>(`/api/users${qs ? `?${qs}` : ''}`);
}

export function apiGetUserFilterOptions(
  field: string,
  params: Omit<GetUsersParams, 'sortField' | 'sortOrder' | 'page' | 'pageSize'> = {},
) {
  const query = new URLSearchParams();
  query.set('field', field);
  if (params.email) query.set('email', params.email);
  if (params.filterIds) query.set('filterIds', params.filterIds);
  if (params.filterEmails) query.set('filterEmails', params.filterEmails);
  if (params.filterRoles) query.set('filterRoles', params.filterRoles);
  if (params.filterDates) query.set('filterDates', params.filterDates);
  return request<string[]>(`/api/users/filter-options?${query.toString()}`);
}

export function apiGetUserById(id: number | string) {
  return request<UserRow>(`/api/users/${id}`);
}

export function apiUpdateUser(id: number | string, data: { email?: string; roles?: string[] }) {
  return request<UserRow>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeleteUser(id: number | string) {
  return request<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' });
}
