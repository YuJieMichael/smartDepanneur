import { request } from '@/lib/request';

export type AgentActionStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export interface PurchaseOrderActionPayload {
  language: 'en' | 'fr' | 'zh';
  businessDate: string;
  itemCount: number;
  supplierCount: number;
  estimatedTotal: string;
}

export interface MinStockActionPayload {
  productId: number;
  productName: string;
  currentMinStock: number;
  newMinStock: number;
}

export interface AgentAction {
  id: number;
  type: 'generate_purchase_orders' | 'set_min_stock';
  status: AgentActionStatus;
  payload: PurchaseOrderActionPayload | MinStockActionPayload;
  rationale: string;
  source: 'openai-agent' | 'local-agent' | 'mcp' | 'min-stock-review';
  result: unknown;
  error: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy: { id: number; email: string } | null;
  decidedBy: { id: number; email: string } | null;
}

export function apiGetAgentActions(status?: AgentActionStatus) {
  return request<AgentAction[]>(
    status ? `/api/agent-actions?status=${status}` : '/api/agent-actions',
  );
}

export function apiApproveAgentAction(id: number) {
  return request<AgentAction>(`/api/agent-actions/${id}/approve`, { method: 'POST' });
}

export function apiRejectAgentAction(id: number, reason?: string) {
  return request<AgentAction>(`/api/agent-actions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function apiProposeMinStock(productId: number, newMinStock: number) {
  return request<{ id: number; created: boolean }>('/api/agent-actions/min-stock', {
    method: 'POST',
    body: JSON.stringify({ productId, newMinStock }),
  });
}
