import { request } from '@/lib/request';

export interface PostField {
  title: string;
  type: 'text' | 'select' | 'textarea' | 'number' | 'file';
  required: boolean;
  options?: string[];
}

export interface JobPostTemplate {
  id: number;
  templateName: string;
  fields: PostField[];
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export async function apiGetTemplatesByUser(userId: number): Promise<JobPostTemplate[]> {
  return request<JobPostTemplate[]>(`/api/job-post-templates/user/${userId}`);
}

export async function apiCreateTemplate(data: {
  templateName: string;
  fields: PostField[];
}): Promise<JobPostTemplate> {
  return request<JobPostTemplate>('/api/job-post-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiGetTemplateById(id: number): Promise<JobPostTemplate> {
  return request<JobPostTemplate>(`/api/job-post-templates/${id}`);
}

export async function apiUpdateTemplate(id: number, data: {
  templateName: string;
  fields: PostField[];
}): Promise<JobPostTemplate> {
  return request<JobPostTemplate>(`/api/job-post-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
