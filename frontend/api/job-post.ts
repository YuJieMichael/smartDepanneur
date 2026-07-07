import { request } from '@/lib/request';
import type { PostField } from './job-post-template';

export interface JobPost {
  id: number;
  title: string;
  jobDescription: string;
  state: 'active' | 'closed';
  questions: PostField[];
  postedAt: string;
  postedBy: string;
  reviewer: string[];
  collector: number[];
  userId: number;
  appliedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GetJobPostListParams {
  title?: string;
  filterStates?: string;
  filterPostedDates?: string;
  filter?: 'all' | 'collected' | 'applied' | 'my';
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GetJobPostListResult {
  total: number;
  list: JobPost[];
  page: number;
  pageSize: number;
}

export function apiGetJobPostList(params: GetJobPostListParams = {}) {
  const query = new URLSearchParams();
  if (params.title) query.set('title', params.title);
  if (params.filterStates) query.set('filterStates', params.filterStates);
  if (params.filterPostedDates) query.set('filterPostedDates', params.filterPostedDates);
  if (params.filter) query.set('filter', params.filter);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<GetJobPostListResult>(`/api/job-posts/list${qs ? `?${qs}` : ''}`);
}

export function apiGetJobPostById(id: number) {
  return request<JobPost>(`/api/job-posts/${id}`);
}

export async function apiCreateJobPost(data: {
  title: string;
  jobDescription: string;
  questions: PostField[];
  reviewer: string;
}): Promise<JobPost> {
  return request<JobPost>('/api/job-posts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiAddReviewer(id: number) {
  return request<JobPost>(`/api/job-posts/${id}/reviewers`, { method: 'PATCH' });
}

export function apiToggleCollector(id: number) {
  return request<JobPost>(`/api/job-posts/${id}/collector`, { method: 'PATCH' });
}

export function apiUpdateJobPost(id: number, data: Record<string, any>) {
  return request<JobPost>(`/api/job-posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function apiDeleteJobPost(id: number) {
  return request<void>(`/api/job-posts/${id}`, { method: 'DELETE' });
}
