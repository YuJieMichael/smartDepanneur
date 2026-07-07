import { request } from '@/lib/request';

export interface DashboardOverview {
  products: {
    total: number;
    active: number;
    lowStock: number;
    expiringSoon: number;
  };
  today: {
    saleCount: number;
    revenue: string;
    profit: string;
  };
  topSellers: Array<{
    productId: number;
    productName: string;
    currentStock: number;
    totalSold: number;
  }>;
  lowStockList: Array<{
    id: number;
    name: string;
    currentStock: number;
    minStock: number;
    supplier: { id: number; name: string } | null;
  }>;
  expiringList: Array<{
    id: number;
    name: string;
    currentStock: number;
    expirationDate: string;
    supplier: { id: number; name: string } | null;
  }>;
}

export function apiGetDashboardOverview() {
  return request<DashboardOverview>('/api/dashboard/overview');
}
