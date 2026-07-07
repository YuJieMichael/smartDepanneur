import { request } from '@/lib/request';

export interface Application {
  id: number;
  userId: number;
  jobPostId: number;
  answers: { title: string; value: string }[];
  state: 'applied' | 'rejected' | 'reviewed';
  user?: { id: number; email: string };
  jobPost?: { id: number; title: string };
  createdAt: string;
  updatedAt: string;
}

export function apiCreateApplication(data: { jobPostId: number; answers: { title: string; value: string }[] }) {
  return request<Application>('/api/applications', { method: 'POST', body: JSON.stringify(data) });
}

export function apiCheckApplication(jobPostId: number) {
  return request<{ applied: boolean; application: Application | null }>(`/api/applications/check?jobPostId=${jobPostId}`);
}

export function apiGetMyApplications() {
  return request<{ id: number; jobPostId: number; state: string }[]>('/api/applications/my');
}

export function apiGetApplicationsByPostId(postId: number, params: {
  search?: string;
  filterStates?: string;
  filterDates?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.filterStates) query.set('filterStates', params.filterStates);
  if (params.filterDates) query.set('filterDates', params.filterDates);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<{ total: number; list: Application[]; page: number; pageSize: number }>(
    `/api/applications/by-post/${postId}${qs ? `?${qs}` : ''}`,
  );
}

export function apiGetApplicationFilterOptions(postId: number, field: string) {
  return request<string[]>(`/api/applications/by-post/${postId}/filter-options?field=${encodeURIComponent(field)}`);
}

export function apiUpdateApplicationState(id: number, state: string) {
  return request<Application>(`/api/applications/${id}/state`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
  });
}

export function apiReviewAllByPostId(postId: number) {
  return request<{ count: number }>(`/api/applications/by-post/${postId}/review-all`, {
    method: 'PATCH',
  });
}

export function apiGetApplicationById(id: number) {
  return request<Application>(`/api/applications/${id}`);
}
