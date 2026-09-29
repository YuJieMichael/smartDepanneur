import { AUTH_STORAGE_KEY } from '@/lib/demo/config';
import type { ProductRow, ProductPayload } from '@/api/products';
import type { SaleRow, CreateSalePayload, VoidSalePayload } from '@/api/sales';
import type { CategoryRow } from '@/api/categories';
import type { SupplierRow } from '@/api/suppliers';
import type { InventoryMovementRow } from '@/api/inventory';
import type { GeneratedPurchaseOrder, ReorderSuggestion } from '@/api/insights';
import type { DailyCloseoutReport } from '@/api/dashboard';
import type { User } from '@/lib/store';
import { ApiError } from '@/lib/request';

const STORAGE_KEY = 'smartdepanneur-preview-v1';
const money = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const now = () => new Date().toISOString();
const dateKey = (date = now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
const dayOffset = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1;
const fail = (message: string, status = 400): never => { throw new ApiError(status, message); };
const positiveInteger = (n: number) => Number.isSafeInteger(n) && n > 0;
const copy = <T,>(value: T): T => structuredClone(value);
type DemoState = {
  version: 1;
  products: ProductRow[];
  categories: CategoryRow[];
  suppliers: SupplierRow[];
  sales: SaleRow[];
  movements: InventoryMovementRow[];
  orders: GeneratedPurchaseOrder[];
};
let memory: DemoState | undefined;

function demoUser(cashier = false): User {
  return { id: cashier ? 2 : 1, email: `${cashier ? 'cashier' : 'owner'}@smartdepanneur.local`, createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z', roles: [{
    id: cashier ? 2 : 1, name: cashier ? 'Cashier' : 'Store Owner',
    permissions: (cashier ? ['sales-edit'] : ['product-edit', 'sales-edit', 'inventory-edit', 'dashboard-view', 'insights-view', 'audit-view-store']).map((name, i) => ({ id: i + 1, name })),
  }] };
}

function relations(state: DemoState, product: ProductRow): ProductRow {
  return { ...product, category: state.categories.find((r) => r.id === product.categoryId) ?? null, supplier: state.suppliers.find((r) => r.id === product.supplierId) ?? null };
}

function movement(state: DemoState, product: ProductRow, delta: number, type: InventoryMovementRow['type'], user: User, reason: string, createdAt = now(), referenceId: number | null = null) {
  if (!Number.isSafeInteger(delta) || product.currentStock + delta < 0) fail('Insufficient demo stock / Stock insuffisant / 演示库存不足');
  product.currentStock += delta;
  product.updatedAt = createdAt;
  const row: InventoryMovementRow = { id: nextId(state.movements), type, quantity: delta, unitCost: product.costPrice, reason, referenceType: type === 'sale' || type === 'return_item' ? 'sale' : null, referenceId, createdAt, productId: product.id, userId: user.id, user: { id: user.id, email: user.email }, product: { id: product.id, name: product.name, sku: product.sku, barcode: product.barcode, currentStock: product.currentStock } };
  state.movements.push(row);
  return row;
}

function createSale(state: DemoState, data: CreateSalePayload, user: User, createdAt = now()): SaleRow {
  if (!Array.isArray(data.items) || !data.items.length) fail('Add a product first');
  const needed = new Map<number, number>();
  const items = data.items.map((item, index) => {
    const p = state.products.find((r) => r.id === item.productId && r.isActive) ?? fail('Product unavailable');
    if (!positiveInteger(item.quantity)) fail('Quantity must be a positive integer');
    const price = Number(item.unitPrice ?? p.sellingPrice);
    if (!Number.isFinite(price) || price < 0) fail('Invalid price');
    needed.set(p.id, (needed.get(p.id) ?? 0) + item.quantity);
    return { id: index + 1, productId: p.id, quantity: item.quantity, unitPrice: money(price), unitCost: p.costPrice, lineTotal: money(Number(money(price)) * item.quantity), product: { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode } };
  });
  for (const [id, quantity] of needed) {
    if (state.products.find((p) => p.id === id)!.currentStock < quantity) fail('Insufficient demo stock / Stock insuffisant / 演示库存不足');
  }
  const rate = Number(data.taxRate ?? 0.14975);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) fail('Invalid tax rate');
  const subtotal = money(sum(items.map((r) => Number(r.lineTotal))));
  const tax = money(Number(subtotal) * rate);
  const id = nextId(state.sales);
  const sale: SaleRow = { id, saleNumber: `DEMO-${String(id).padStart(5, '0')}`, subtotal, tax, total: money(Number(subtotal) + Number(tax)), profitEstimate: money(sum(items.map((r) => (Number(r.unitPrice) - Number(r.unitCost)) * r.quantity))), paymentMethod: data.paymentMethod ?? 'cash', isVoided: false, voidedAt: null, voidReason: null, createdAt, updatedAt: createdAt, cashierId: user.id, cashier: { id: user.id, email: user.email }, voidedById: null, voidedBy: null, voidApprovedById: null, voidApprovedBy: null, voidPolicy: { canVoid: true, restriction: null, requiresOwnerApproval: false, windowEndsAt: null, largeVoidThreshold: '100.00' }, items };
  for (const [productId, quantity] of needed) movement(state, state.products.find((p) => p.id === productId)!, -quantity, 'sale', user, sale.saleNumber, createdAt, id);
  state.sales.push(sale);
  return sale;
}

function seed(): DemoState {
  const createdAt = dayOffset(-30);
  const categories = ['Beverages', 'Dairy', 'Snacks', 'Bakery', 'Household'].map((name, i) => ({ id: i + 1, name, code: `DEMO-C${i + 1}`, createdAt, updatedAt: createdAt }));
  const suppliers = ['Distribution Boréale (démo)', 'Ferme du Quartier (démo)', 'Boulangerie du Coin (démo)'].map((name, i) => ({ id: i + 1, name, contactName: 'Demo contact', phone: null, email: `supplier${i + 1}@example.com`, notes: 'Fictional supplier. No orders are sent.', createdAt, updatedAt: createdAt }));
  const samples: [string, number, number, number, number, number, number, number | null][] = [
    ['Eau de source 500 ml', 1, 1, 100, 20, 0.45, 1.49, null],
    ['Lait 2 % 1 L', 2, 2, 7, 12, 2.1, 3.69, 3],
    ['Croustilles nature 200 g', 3, 1, 65, 15, 1.6, 3.49, null],
    ['Pain de blé entier', 4, 3, 4, 8, 2.2, 4.29, 2],
    ['Café glacé 330 ml', 1, 1, 52, 10, 1.7, 3.79, 45],
    ['Yogourt vanille 500 g', 2, 2, 9, 10, 2.3, 4.49, 5],
    ['Jus de pomme 1 L', 1, 1, 44, 10, 1.8, 3.59, 60],
    ['Barre de chocolat', 3, 1, 72, 18, 0.8, 1.99, null],
    ['Croissant au beurre', 4, 3, 3, 8, 0.95, 2.49, 1],
    ['Savon à vaisselle', 5, 1, 25, 5, 2.5, 5.49, null],
    ['Boisson gazeuse 355 ml', 1, 1, 90, 20, 0.65, 1.79, null],
    ['Biscuits aux pépites', 3, 1, 40, 8, 1.9, 3.99, 90],
    ['Fromage cheddar 200 g', 2, 2, 0, 6, 3.1, 5.99, 14],
    ['Mouchoirs boîte de 100', 5, 1, 18, 5, 1.2, 2.99, null],
    ['Muffin aux bleuets', 4, 3, 6, 8, 1.1, 2.79, -1],
    ['Eau pétillante 1 L', 1, 1, 40, 10, 0.9, 2.49, null],
  ];
  const products: ProductRow[] = samples.map(([name, categoryId, supplierId, currentStock, minStock, cost, price, expiry], i) => ({ id: i + 1, name, categoryId, supplierId, currentStock: 0, minStock, costPrice: money(cost), sellingPrice: money(price), unit: 'unit', sku: `DEMO-${String(i + 1).padStart(3, '0')}`, barcode: `20000000${String(i + 1).padStart(4, '0')}`, expirationTracked: expiry !== null, expirationDate: expiry === null ? null : dayOffset(expiry), isActive: true, createdAt, updatedAt: createdAt, createdById: 1, createdBy: { id: 1, email: demoUser().email }, category: categories.find((c) => c.id === categoryId)!, supplier: suppliers.find((s) => s.id === supplierId)!, initialStock: currentStock }));
  const state: DemoState = { version: 1, products, categories, suppliers, sales: [], movements: [], orders: [] };
  products.forEach((p, i) => movement(state, p, samples[i][3], 'purchase', demoUser(), 'Opening demo stock', createdAt));
  const sellingIds = [1, 3, 5, 7, 8, 11, 12, 16];
  for (let day = -6; day <= 0; day++) {
    for (let j = 0; j < 3; j++) {
      const index = (day + 6 + j) % sellingIds.length;
      createSale(state, { items: [{ productId: sellingIds[index], quantity: j + 1 }, { productId: sellingIds[(index + 2) % sellingIds.length], quantity: 1 }], paymentMethod: j === 0 ? 'cash' : j === 1 ? 'debit' : 'credit' }, demoUser(true), dayOffset(day));
    }
  }
  return state;
}

function read(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as DemoState;
      if (stored.version === 1 && [stored.products, stored.categories, stored.suppliers, stored.sales, stored.movements, stored.orders].every(Array.isArray)) return stored;
    }
  } catch { /* Private browsing can disable storage; use this tab's memory. */ }
  return copy(memory ?? (memory = seed()));
}

function save(state: DemoState) {
  memory = copy(state);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* The preview remains usable in memory. */ }
}

export function resetDemo() {
  memory = seed();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* No persisted state to clear. */ }
  save(memory);
}

function fieldValue(row: object, key: string): string | number | boolean {
  const value = (row as Record<string, unknown>)[key];
  if (key === 'productName') return ((row as Record<string, unknown>).product as { name?: string })?.name ?? '';
  if (value && typeof value === 'object') return (value as { name?: string }).name ?? '';
  if (key.endsWith('At')) return value ? dateKey(String(value)) : '';
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : '';
}

function filtered<T extends object>(rows: T[], params: URLSearchParams): T[] {
  const filters: Record<string, string> = { filterIds: 'id', filterNames: 'name', filterCategories: 'category', filterSuppliers: 'supplier', filterActive: 'isActive', filterCreatedDates: 'createdAt', filterUpdatedDates: 'updatedAt', filterCodes: 'code', filterContactNames: 'contactName', filterEmails: 'email', filterTypes: 'type', filterProductNames: 'productName', filterPaymentMethods: 'paymentMethod' };
  return rows.filter((r) => {
    for (const key of ['name', 'productName']) {
      const q = params.get(key)?.toLowerCase();
      if (q && ![fieldValue(r, key), fieldValue(r, 'sku'), fieldValue(r, 'barcode')].some((v) => String(v).toLowerCase().includes(q))) return false;
    }
    return Object.entries(filters).every(([param, key]) => {
      const value = params.get(param);
      if (!value) return true;
      let choices: string[];
      try { const parsed = JSON.parse(value); choices = Array.isArray(parsed) ? parsed.map(String) : value.split(','); } catch { choices = value.split(','); }
      return choices.includes(String(fieldValue(r, key)));
    });
  });
}

function list<T extends object>(rows: T[], params: URLSearchParams) {
  const result = filtered(rows, params);
  const key = params.get('sortField') ?? 'id';
  result.sort((a, b) => {
    const av = fieldValue(a, key); const bv = fieldValue(b, key);
    return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true })) * (params.get('sortOrder') === 'asc' ? 1 : -1);
  });
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(params.get('pageSize')) || 10));
  return { total: result.length, list: result.slice((page - 1) * pageSize, page * pageSize), page, pageSize };
}

function closeout(state: DemoState, date: string): DailyCloseoutReport {
  const sales = state.sales.filter((s) => !s.isVoided && dateKey(s.createdAt) === date);
  const categories = state.categories.map((c) => {
    const items = sales.flatMap((s) => s.items).filter((i) => state.products.find((p) => p.id === i.productId)?.categoryId === c.id);
    const revenue = sum(items.map((i) => Number(i.lineTotal)));
    const profit = sum(items.map((i) => (Number(i.unitPrice) - Number(i.unitCost)) * i.quantity));
    return { categoryId: c.id, categoryName: c.name, quantity: sum(items.map((i) => i.quantity)), revenue: money(revenue), grossProfit: money(profit), grossMargin: money(revenue ? profit / revenue * 100 : 0) };
  }).filter((c) => c.quantity);
  const subtotal = sum(sales.map((s) => Number(s.subtotal)));
  const grossProfit = sum(sales.map((s) => Number(s.profitEstimate)));
  return { date, timeZone: 'America/Toronto', generatedAt: now(), saleCount: sales.length, totals: { subtotal: money(subtotal), tax: money(sum(sales.map((s) => Number(s.tax)))), revenue: money(sum(sales.map((s) => Number(s.total)))), grossProfit: money(grossProfit), grossMargin: money(subtotal ? grossProfit / subtotal * 100 : 0) }, categories };
}

function topSellers(state: DemoState, days = 7) {
  const items = state.sales.filter((s) => !s.isVoided && Date.parse(s.createdAt) >= Date.now() - days * 86400000).flatMap((s) => s.items);
  return state.products.map((p) => ({ productId: p.id, productName: p.name, sku: p.sku, currentStock: p.currentStock, category: relations(state, p).category, totalSold: sum(items.filter((i) => i.productId === p.id).map((i) => i.quantity)), totalRevenue: money(sum(items.filter((i) => i.productId === p.id).map((i) => Number(i.lineTotal)))) })).filter((p) => p.totalSold).sort((a, b) => b.totalSold - a.totalSold);
}

function reorder(state: DemoState, language: string): ReorderSuggestion[] {
  const tops = topSellers(state);
  return state.products.filter((p) => p.isActive && p.currentStock <= p.minStock).map((p) => {
    const sold = tops.find((t) => t.productId === p.id)?.totalSold ?? 0;
    const quantity = Math.max(1, Math.max(p.minStock * 2, sold) - p.currentStock);
    return { productId: p.id, productName: p.name, sku: p.sku, unit: p.unit, currentStock: p.currentStock, minStock: p.minStock, soldLast7Days: sold, suggestedReorderQty: quantity, unitCost: p.costPrice, estimatedCost: money(quantity * Number(p.costPrice)), urgency: p.currentStock === 0 ? 'critical' : 'high', reason: language === 'zh' ? '演示规则：补至最低库存的两倍或七日销量。' : language === 'fr' ? 'Règle de démo : couvrir deux fois le minimum ou les ventes sur 7 jours.' : 'Demo rule: cover twice the minimum stock or 7-day sales.', supplier: state.suppliers.find((s) => s.id === p.supplierId) ?? null, category: relations(state, p).category };
  });
}

function dispatch(state: DemoState, endpoint: string, options: RequestInit): unknown {
  const url = new URL(endpoint, 'https://demo.invalid');
  const path = url.pathname;
  const query = url.searchParams;
  const method = options.method ?? 'GET';
  const body = options.body ? JSON.parse(String(options.body)) as Record<string, unknown> : {};
  const token = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (path === '/api/auth/login') {
    if (!['owner@smartdepanneur.local', 'cashier@smartdepanneur.local'].includes(String(body.email)) || body.password !== '123456') fail('Use a demo role button', 401);
    return { access_token: body.email === 'owner@smartdepanneur.local' ? 'demo-owner' : 'demo-cashier' };
  }
  if (token !== 'demo-owner' && token !== 'demo-cashier') fail('Select a demo role', 401);
  const user = demoUser(token === 'demo-cashier');
  if (path === '/api/auth/getCurrentUser') return user;
  if (path === '/api/auth/refresh') return { access_token: token };
  if (path.startsWith('/api/auth/')) fail('Account creation is disabled in the demo', 403);
  if (path === '/api/notifications') return [];
  if (token === 'demo-cashier' && !path.startsWith('/api/sales') && !(method === 'GET' && path.startsWith('/api/products'))) fail('Switch to the Store Owner demo', 403);

  const products = state.products.map((p) => relations(state, p));
  const lowStock = products.filter((p) => p.isActive && p.currentStock <= p.minStock);
  const expires = products.filter((p) => p.isActive && p.expirationTracked && p.expirationDate).map((p) => ({ ...p, daysUntilExpiration: Math.ceil((Date.parse(p.expirationDate!) - Date.now()) / 86400000), status: Date.parse(p.expirationDate!) < Date.now() ? 'expired' : 'expiring_soon' })).filter((p) => p.daysUntilExpiration <= Number(query.get('days') ?? 7));
  const today = closeout(state, dateKey());
  if (path === '/api/dashboard/overview') return { products: { total: products.length, active: products.filter((p) => p.isActive).length, lowStock: lowStock.length, expiringSoon: expires.length }, today: { saleCount: today.saleCount, revenue: today.totals.revenue, profit: today.totals.grossProfit, voidCount: state.sales.filter((s) => s.isVoided && dateKey(s.voidedAt!) === dateKey()).length, voidAmount: money(sum(state.sales.filter((s) => s.isVoided && dateKey(s.voidedAt!) === dateKey()).map((s) => Number(s.total)))) }, topSellers: topSellers(state), lowStockList: lowStock, expiringList: expires };
  if (path === '/api/dashboard/daily-closeout') return closeout(state, query.get('date') ?? dateKey());
  if (path === '/api/dashboard/sales-trend') {
    const days = Math.min(30, Math.max(1, Number(query.get('days')) || 7));
    const points = Array.from({ length: days }, (_, i) => { const report = closeout(state, dateKey(dayOffset(i - days + 1))); return { date: report.date, saleCount: report.saleCount, revenue: report.totals.revenue, profit: report.totals.grossProfit }; });
    const previous = Array.from({ length: days }, (_, i) => closeout(state, dateKey(dayOffset(i - 2 * days + 1))));
    const change = (current: number, before: number) => before ? money((current - before) / before * 100) : null;
    return { timeZone: 'America/Toronto', days, points, comparison: { saleCountDelta: sum(points.map((p) => p.saleCount)) - sum(previous.map((p) => p.saleCount)), revenueChangePercent: change(sum(points.map((p) => Number(p.revenue))), sum(previous.map((p) => Number(p.totals.revenue)))), profitChangePercent: change(sum(points.map((p) => Number(p.profit))), sum(previous.map((p) => Number(p.totals.grossProfit)))) } };
  }

  const collection = path.match(/^\/api\/(products|categories|suppliers)(?:\/(.*))?$/);
  if (collection) {
    const key = collection[1] as 'products' | 'categories' | 'suppliers';
    const suffix = collection[2] ?? '';
    const rows: Array<ProductRow | CategoryRow | SupplierRow> = key === 'products' ? products : state[key];
    if (method === 'GET') {
      if (!suffix) return rows;
      if (suffix === 'list') return list(rows, query);
      if (suffix === 'filter-options') return [...new Set(filtered(rows, query).map((r) => String(fieldValue(r, query.get('field') ?? 'name'))))].filter(Boolean);
      return rows.find((r) => r.id === Number(suffix.replace('detail/', ''))) ?? fail('Not found', 404);
    }
    const id = Number(suffix);
    if (method === 'DELETE') {
      if (key === 'products') {
        const p = state.products.find((r) => r.id === id) ?? fail('Not found', 404);
        if (state.sales.some((s) => s.items.some((i) => i.productId === id)) || state.movements.some((m) => m.productId === id)) fail('This demo product has history; set it inactive instead.');
        state.products = state.products.filter((r) => r.id !== p.id);
      } else {
        const field = key === 'categories' ? 'categoryId' : 'supplierId';
        if (state.products.some((p) => p[field] === id)) fail('This item is still used by a demo product');
        if (key === 'categories') state.categories = state.categories.filter((r) => r.id !== id);
        else state.suppliers = state.suppliers.filter((r) => r.id !== id);
      }
      return { success: true };
    }
    if (method !== 'POST' && method !== 'PATCH') fail('Unsupported action', 405);
    const existing = method === 'PATCH' ? rows.find((r) => r.id === id) ?? fail('Not found', 404) : null;
    const name = String(body.name ?? existing?.name ?? '').trim();
    if (!name) fail('Name is required');
    const meta = { id: existing?.id ?? nextId(rows), name, createdAt: existing?.createdAt ?? now(), updatedAt: now() };
    if (key === 'products') {
      const prior = existing as ProductRow | null;
      const p = body as unknown as ProductPayload;
      const product: ProductRow = { ...meta, barcode: p.barcode === undefined ? prior?.barcode ?? null : p.barcode, sku: p.sku === undefined ? prior?.sku ?? null : p.sku, unit: p.unit ?? prior?.unit ?? 'unit', currentStock: Number(p.currentStock ?? prior?.currentStock ?? 0), minStock: Number(p.minStock ?? prior?.minStock ?? 0), costPrice: money(Number(p.costPrice ?? prior?.costPrice ?? 0)), sellingPrice: money(Number(p.sellingPrice ?? prior?.sellingPrice ?? 0)), expirationTracked: p.expirationTracked ?? prior?.expirationTracked ?? false, expirationDate: p.expirationDate === undefined ? prior?.expirationDate ?? null : p.expirationDate, isActive: p.isActive ?? prior?.isActive ?? true, categoryId: p.categoryId === undefined ? prior?.categoryId ?? null : p.categoryId, supplierId: p.supplierId === undefined ? prior?.supplierId ?? null : p.supplierId, createdById: prior?.createdById ?? user.id, createdBy: prior?.createdBy ?? { id: user.id, email: user.email }, category: null, supplier: null };
      if (![product.currentStock, product.minStock].every((n) => Number.isSafeInteger(n) && n >= 0) || ![product.costPrice, product.sellingPrice].every((n) => Number.isFinite(Number(n)) && Number(n) >= 0)) fail('Invalid stock or price');
      if (product.categoryId !== null && !state.categories.some((c) => c.id === product.categoryId)) fail('Unknown category');
      if (product.supplierId !== null && !state.suppliers.some((s) => s.id === product.supplierId)) fail('Unknown supplier');
      if (product.expirationDate && !Number.isFinite(Date.parse(product.expirationDate))) fail('Invalid expiration date');
      if (state.products.some((r) => r.id !== product.id && ((product.sku && r.sku === product.sku) || (product.barcode && r.barcode === product.barcode)))) fail('SKU or barcode already exists');
      const stockDelta = product.currentStock - (prior?.currentStock ?? 0);
      product.currentStock -= stockDelta;
      state.products = [...state.products.filter((r) => r.id !== product.id), product];
      if (stockDelta) movement(state, product, stockDelta, prior ? 'adjustment' : 'purchase', user, 'Demo product stock update');
      return relations(state, product);
    }
    if (key === 'categories') {
      const row: CategoryRow = { ...meta, code: body.code === undefined ? (existing as CategoryRow | null)?.code ?? null : body.code ? String(body.code) : null };
      state.categories = [...state.categories.filter((r) => r.id !== row.id), row]; return row;
    }
    const previous = existing as SupplierRow | null;
    const optional = (field: 'contactName' | 'phone' | 'email' | 'notes') => body[field] === undefined ? previous?.[field] ?? null : body[field] ? String(body[field]) : null;
    const row: SupplierRow = { ...meta, contactName: optional('contactName'), phone: optional('phone'), email: optional('email'), notes: optional('notes') };
    state.suppliers = [...state.suppliers.filter((r) => r.id !== row.id), row]; return row;
  }

  if (path === '/api/inventory/low-stock') return lowStock;
  if (path === '/api/inventory/expiration-alerts') return expires;
  if (path === '/api/inventory/movements') return list(state.movements, query);
  if (path === '/api/inventory/filter-options') return [...new Set(filtered(state.movements, query).map((r) => String(fieldValue(r, query.get('field') ?? 'type'))))];
  if (['/api/inventory/stock-in', '/api/inventory/adjust', '/api/inventory/waste'].includes(path) && method === 'POST') {
    const product = state.products.find((p) => p.id === Number(body.productId)) ?? fail('Product not found');
    const quantity = Number(body.quantity);
    const adjust = path.endsWith('/adjust');
    if (!Number.isSafeInteger(quantity) || quantity === 0 || (!adjust && quantity < 0)) fail('Invalid quantity');
    return movement(state, product, path.endsWith('/waste') ? -quantity : quantity, adjust ? 'adjustment' : path.endsWith('/waste') ? 'waste' : 'purchase', user, String(body.reason ?? 'Demo stock change'));
  }
  const salePolicy = (sale: SaleRow): SaleRow => ({ ...sale, voidPolicy: { ...sale.voidPolicy, canVoid: !sale.isVoided && (user.id === 1 || sale.cashierId === user.id), restriction: sale.isVoided ? 'already_voided' : user.id !== 1 && sale.cashierId !== user.id ? 'not_own_sale' : null, requiresOwnerApproval: user.id !== 1 && Number(sale.total) >= 100 } });
  if (path === '/api/sales' && method === 'POST') return salePolicy(createSale(state, body as unknown as CreateSalePayload, user));
  if (path === '/api/sales/recent') return state.sales.slice().reverse().slice(0, Math.min(100, Number(query.get('limit')) || 10)).map(salePolicy);
  if (path === '/api/sales/list') return list(state.sales.map(salePolicy), query);
  if (path === '/api/sales/summary/daily') { const report = closeout(state, query.get('date') ?? dateKey()); return { date: report.date, saleCount: report.saleCount, totalRevenue: report.totals.revenue, totalProfit: report.totals.grossProfit, topSellers: topSellers(state).map((p) => ({ ...p, quantitySold: p.totalSold, revenue: p.totalRevenue })) }; }
  const saleMatch = path.match(/^\/api\/sales\/(\d+)(\/void)?$/);
  if (saleMatch) {
    const sale = state.sales.find((s) => s.id === Number(saleMatch[1])) ?? fail('Sale not found', 404);
    if (saleMatch[2] && method === 'POST') {
      const policy = salePolicy(sale).voidPolicy;
      const data = body as unknown as VoidSalePayload;
      if (!policy.canVoid) fail('This demo sale cannot be voided');
      if (!data.reason) fail('A reason is required');
      if (policy.requiresOwnerApproval && (data.ownerEmail !== demoUser().email || data.ownerPassword !== '123456')) fail('Demo owner: owner@smartdepanneur.local / 123456');
      for (const item of sale.items) movement(state, state.products.find((p) => p.id === item.productId)!, item.quantity, 'return_item', user, `Void ${sale.saleNumber}`, now(), sale.id);
      Object.assign(sale, { isVoided: true, voidedAt: now(), updatedAt: now(), voidReason: data.reason, voidedById: user.id, voidedBy: { id: user.id, email: user.email } });
    }
    return salePolicy(sale);
  }

  const language = String(query.get('language') ?? body.language ?? 'en');
  const suggestions = reorder(state, language);
  const summary = language === 'zh' ? `${suggestions.length} 种演示商品需要补货。` : language === 'fr' ? `${suggestions.length} produits fictifs à réapprovisionner.` : `${suggestions.length} demo products need restocking.`;
  const slowMovers = products.filter((p) => p.isActive && p.currentStock > 0 && !topSellers(state, 30).some((t) => t.productId === p.id)).map((p) => ({ ...p, stockValue: money(p.currentStock * Number(p.costPrice)) }));
  if (path === '/api/insights/reorder') return { suggestions, summary };
  if (path === '/api/insights/top-sellers') return { topSellers: topSellers(state) };
  if (path === '/api/insights/slow-movers') return { slowMovers, message: language === 'zh' ? '根据演示销售记录计算。' : language === 'fr' ? 'Calculé à partir des ventes fictives.' : 'Calculated from demo sales history.' };
  if (path === '/api/insights/ask') {
    const question = String(body.question ?? '');
    const isTop = /top|best|mieux|最好/i.test(question);
    const isSlow = /slow|not sell|mal|卖不动/i.test(question);
    const names = isTop ? topSellers(state).slice(0, 5).map((p) => `${p.productName}: ${p.totalSold}`) : isSlow ? slowMovers.map((p) => p.name) : suggestions.map((p) => `${p.productName}: +${p.suggestedReorderQty}`);
    const intro = language === 'zh' ? '演示规则生成的结果（未调用 AI）：' : language === 'fr' ? 'Résultat des règles de démonstration (sans appel à une IA) :' : 'Demo rule-based result (no AI service called):';
    return { question, language, answer: `${intro}\n${isTop || isSlow ? '' : summary}\n${names.join('\n') || '—'}`, type: 'demo', provider: 'local-agent', toolsUsed: [isTop ? 'get_top_sellers' : isSlow ? 'get_slow_movers' : 'get_reorder_suggestions'], fallbackReason: 'demo-mode' };
  }
  if (path === '/api/purchase-orders/generate-from-reorder' && method === 'POST') {
    let createdCount = 0; let updatedCount = 0;
    const orders: GeneratedPurchaseOrder[] = [];
    for (const supplierId of new Set(suggestions.map((s) => s.supplier?.id ?? null))) {
      const existing = state.orders.find((o) => o.businessDate === dateKey() && (o.supplier?.id ?? null) === supplierId);
      if (existing) updatedCount++; else createdCount++;
      const id = existing?.id ?? nextId(state.orders);
      const items = suggestions.filter((s) => (s.supplier?.id ?? null) === supplierId).map((s, i) => ({ id: i + 1, productId: s.productId, productName: s.productName, sku: s.sku, unit: s.unit, quantity: s.suggestedReorderQty, unitCost: s.unitCost, lineTotal: s.estimatedCost }));
      const order: GeneratedPurchaseOrder = { id, orderNumber: `DEMO-PO-${String(id).padStart(4, '0')}`, businessDate: dateKey(), status: 'draft', estimatedTotal: money(sum(items.map((i) => Number(i.lineTotal)))), supplier: state.suppliers.find((s) => s.id === supplierId) ?? null, items };
      state.orders = [...state.orders.filter((o) => o.id !== id), order]; orders.push(order);
    }
    return { businessDate: dateKey(), createdCount, updatedCount, orders };
  }
  if (path.startsWith('/api/audit-trail/')) return { total: 0, list: [], page: 1, pageSize: 10 };
  if (path.startsWith('/api/dictionary')) return path === '/api/dictionary' ? [] : null;
  return fail('This feature is not available in the browser demo', 404);
}

/** Local simulation only. No network, database, payment or AI credentials. */
export async function demoRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const state = read();
  const result = dispatch(state, endpoint, options);
  save(state);
  return copy(result) as T;
}
