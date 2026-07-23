import { request } from "@/lib/request";

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

export interface DailyCloseoutReport {
  date: string;
  timeZone: string;
  generatedAt: string;
  saleCount: number;
  totals: {
    subtotal: string;
    tax: string;
    revenue: string;
    grossProfit: string;
    grossMargin: string;
  };
  categories: Array<{
    categoryId: number | null;
    categoryName: string;
    quantity: number;
    revenue: string;
    grossProfit: string;
    grossMargin: string;
  }>;
}

export function apiGetDashboardOverview() {
  return request<DashboardOverview>("/api/dashboard/overview");
}

export function apiGetDailyCloseout(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<DailyCloseoutReport>(`/api/dashboard/daily-closeout${query}`);
}
