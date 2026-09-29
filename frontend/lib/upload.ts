import { AUTH_STORAGE_KEY, DEMO_MODE } from '@/lib/demo/config';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface UploadResult {
  url: string;
  originalname: string;
}

export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  if (DEMO_MODE) return Promise.reject(new Error('File uploads are disabled in the demo'));
  return new Promise((resolve, reject) => {
    const token = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error('Upload failed'));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));

    xhr.open('POST', `${API_URL}/api/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}
