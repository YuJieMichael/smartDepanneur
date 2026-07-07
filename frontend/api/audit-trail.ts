import { request } from '@/lib/request';

export interface AuditTrailItem {
  id: number;
  table: string;
  recordId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userId: number;
  userEmail: string;
  createdAt: string;
}

export interface AuditTrailResult {
  total: number;
  list: AuditTrailItem[];
  page: number;
  pageSize: number;
}

export function apiGetAuditTrail(table: string, recordId: number | string, page = 1, pageSize = 10) {
  return request<AuditTrailResult>(`/api/audit-trail/${table}/${recordId}?page=${page}&pageSize=${pageSize}`);
}
