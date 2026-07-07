import { request } from '@/lib/request';

export interface ApplicantInformation {
  id: number;
  email: string;
  phone: string;
  nickname: string;
  country: string;
  state: string;
  address: string;
  postcode: string;
  resume: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export async function apiGetMyApplicantInfo(): Promise<ApplicantInformation | null> {
  return request<ApplicantInformation | null>('/api/applicant-info/me');
}

export async function apiCreateApplicantInfo(data: {
  email: string;
  phone: string;
  nickname: string;
  country: string;
  state: string;
  address: string;
  postcode: string;
  resume: string;
}): Promise<ApplicantInformation> {
  return request<ApplicantInformation>('/api/applicant-info', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateApplicantInfo(data: {
  email: string;
  phone: string;
  nickname: string;
  country: string;
  state: string;
  address: string;
  postcode: string;
  resume: string;
}): Promise<ApplicantInformation> {
  return request<ApplicantInformation>('/api/applicant-info', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
