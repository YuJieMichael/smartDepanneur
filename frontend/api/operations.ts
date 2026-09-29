import { request } from '@/lib/request';
export interface PurchaseOrder {
  id: number;
  orderNumber: string;
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  estimatedTotal: string;
  sentReference: string | null;
  supplier: { name: string } | null;
  items: {
    id: number;
    productId: number;
    productName: string;
    quantity: number;
    receivedQuantity: number;
    unitCost: string;
    product: { expirationTracked: boolean };
  }[];
  receipts: {
    id: number;
    receivedAt: string;
    reference: string | null;
    receivedBy: { email: string };
    lines: {
      id: number;
      quantity: number;
      batch: { lotCode: string; expirationDate: string | null };
    }[];
  }[];
}
export interface Batch {
  id: number;
  productId: number;
  lotCode: string;
  expirationDate: string | null;
  receivedAt: string;
  quantityRemaining: number;
  unitCost: string;
  product: {
    id: number;
    name: string;
    sku: string | null;
    expirationTracked: boolean;
  };
}
export interface Reconciliation {
  saleCount: number;
  voidCount: number;
  openingCash: string;
  cashMovementTotal: string;
  payments: Record<string, string>;
  expected: Record<string, string>;
  counted?: Record<string, string>;
  variance?: Record<string, string>;
}
export interface Shift {
  id: number;
  cashierId: number;
  cashier: { email: string };
  drawer: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  reconciliation: Reconciliation;
  notes: string | null;
  cashMovements: {
    id: number;
    amount: string;
    reason: string;
    createdAt: string;
  }[];
}
export interface ImportPreview {
  fileHash: string;
  rowCount: number;
  canImport: boolean;
  products: {
    row: number;
    name: string;
    sku: string | null;
    barcode: string | null;
    currentStock: number;
    sellingPrice: string;
  }[];
  errors: { row: number; message: string }[];
}
const base = '/api/store-operations';
export const getOrders = () =>
  request<PurchaseOrder[]>(`${base}/purchase-orders`);
export const setOrderStatus = (
  id: number,
  status: 'sent' | 'cancelled',
  reference = '',
) =>
  request(`${base}/purchase-orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reference }),
  });
export const receiveOrder = (
  id: number,
  data: {
    requestId: string;
    reference: string;
    items: {
      orderItemId: number;
      quantity: number;
      lotCode: string;
      expirationDate: string;
      unitCost: string;
    }[];
  },
) =>
  request(`${base}/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const getBatches = () => request<Batch[]>(`${base}/batches`);
export const updateBatch = (
  id: number,
  data: { lotCode: string; expirationDate: string; reason: string },
) =>
  request(`${base}/batches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
export const previewImport = (csv: string) =>
  request<ImportPreview>(`${base}/imports/preview`, {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
export const commitImport = (
  csv: string,
  fileHash: string,
  requestId: string,
) =>
  request<{ count: number }>(`${base}/imports/commit`, {
    method: 'POST',
    body: JSON.stringify({ csv, fileHash, requestId }),
  });
export const getShifts = () => request<Shift[]>(`${base}/shifts`);
export const openShift = (openingCash: string, drawer: string) =>
  request(`${base}/shifts`, {
    method: 'POST',
    body: JSON.stringify({ openingCash, drawer }),
  });
export const closeShift = (
  id: number,
  data: {
    countedCash: string;
    countedDebit: string;
    countedCredit: string;
    countedOther: string;
    notes: string;
  },
) =>
  request(`${base}/shifts/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const addShiftCash = (
  id: number,
  amount: string,
  reason: string,
  requestId: string,
) =>
  request(`${base}/shifts/${id}/cash`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason, requestId }),
  });
