import { request } from '@/lib/request';

export interface Notification {
  id: number;
  message: string;
  url: string;
  reviewed: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export function apiGetNotifications() {
  return request<Notification[]>('/api/notifications');
}

export function apiMarkNotificationReviewed(id: number) {
  return request<Notification>(`/api/notifications/${id}/reviewed`, { method: 'PATCH' });
}

export function apiMarkAllNotificationsReviewed() {
  return request('/api/notifications/reviewed-all', { method: 'PATCH' });
}
