import { ApiError, request } from '@/lib/request';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface InvoiceMatchCandidate {
  productId: number;
  productName: string;
  score: number;
}

export interface ScannedInvoiceLine {
  description: string;
  sku: string | null;
  quantity: number;
  unitCost: number | null;
  match: InvoiceMatchCandidate | null;
  matchedBy: 'sku' | 'barcode' | 'name' | null;
  candidates: InvoiceMatchCandidate[];
  costChange: { catalogueCost: number; invoiceCost: number; changePct: number } | null;
}

export interface ScannedInvoice {
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  alreadyReceived: boolean;
  matchedCount: number;
  costChangeCount: number;
  lines: ScannedInvoiceLine[];
}

// Multipart upload, so it bypasses the JSON request helper.
export async function apiScanInvoice(file: File): Promise<ScannedInvoice> {
  const token = sessionStorage.getItem('access_token');
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_URL}/api/invoices/scan`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Invoice scan failed' }));
    throw new ApiError(res.status, error.message ?? 'Invoice scan failed');
  }
  return res.json() as Promise<ScannedInvoice>;
}

export interface ReceiveInvoicePayload {
  invoiceNumber: string;
  supplierName: string | null;
  lines: { productId: number; quantity: number; unitCost: number | null }[];
}

export function apiReceiveInvoice(payload: ReceiveInvoicePayload) {
  return request<{ receivedLines: number; receivedUnits: number }>('/api/invoices/receive', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
