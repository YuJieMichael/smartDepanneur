import { Prisma } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

const DAY_MS = 86_400_000;

interface FixtureProduct {
  id: number;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPrice: string;
  sellingPrice: string;
  expirationDate: Date | null;
  supplierId: number;
  categoryId: number;
}

const SUPPLIERS = [
  { id: 1, name: 'Metro Beverage Supply', phone: '514-555-0101', email: 'orders@metrobeverage.example' },
  { id: 2, name: 'Laiterie Saint-Laurent', phone: '514-555-0102', email: 'ventes@laiterie.example' },
  { id: 3, name: 'Boulangerie du Quartier', phone: '514-555-0103', email: 'commandes@boulangerie.example' },
  { id: 4, name: 'Local Essentials Depot', phone: '514-555-0104', email: 'orders@essentials.example' },
];

const CATEGORIES = [
  { id: 1, name: 'Drinks' },
  { id: 2, name: 'Dairy' },
  { id: 3, name: 'Bakery' },
  { id: 4, name: 'Snacks' },
  { id: 5, name: 'Household' },
];

// A small depanneur catalogue with one clear answer per question type:
// Red Bull is out of stock, Coca-Cola is the top seller, and the scented
// candle is the largest slow mover.
const PRODUCTS: FixtureProduct[] = [
  { id: 1, name: 'Coca-Cola 355ml', sku: 'DRK-COKE-355', unit: 'can', currentStock: 30, minStock: 24, costPrice: '0.95', sellingPrice: '1.79', expirationDate: null, supplierId: 1, categoryId: 1 },
  { id: 2, name: 'Red Bull 250ml', sku: 'DRK-RB-250', unit: 'can', currentStock: 0, minStock: 18, costPrice: '1.85', sellingPrice: '3.99', expirationDate: null, supplierId: 1, categoryId: 1 },
  { id: 3, name: 'Milk 2% 1L', sku: 'DAI-MILK-1L', unit: 'carton', currentStock: 3, minStock: 10, costPrice: '1.60', sellingPrice: '2.89', expirationDate: new Date(Date.now() + 5 * DAY_MS), supplierId: 2, categoryId: 2 },
  { id: 4, name: 'White Bread', sku: 'BAK-WHITE', unit: 'loaf', currentStock: 4, minStock: 8, costPrice: '1.75', sellingPrice: '3.49', expirationDate: new Date(Date.now() + 3 * DAY_MS), supplierId: 3, categoryId: 3 },
  { id: 5, name: 'Ketchup Chips 235g', sku: 'SNK-CHIPS-KET', unit: 'bag', currentStock: 25, minStock: 12, costPrice: '2.10', sellingPrice: '4.29', expirationDate: null, supplierId: 4, categoryId: 4 },
  { id: 6, name: 'Chocolate Bar', sku: 'SNK-CHOC', unit: 'bar', currentStock: 40, minStock: 20, costPrice: '0.80', sellingPrice: '1.99', expirationDate: null, supplierId: 4, categoryId: 4 },
  { id: 7, name: 'Scented Candle', sku: 'HOU-CANDLE', unit: 'unit', currentStock: 15, minStock: 2, costPrice: '4.50', sellingPrice: '9.99', expirationDate: null, supplierId: 4, categoryId: 5 },
  { id: 8, name: 'Motor Oil 1L', sku: 'HOU-OIL-1L', unit: 'bottle', currentStock: 8, minStock: 2, costPrice: '6.20', sellingPrice: '11.99', expirationDate: null, supplierId: 4, categoryId: 5 },
  { id: 9, name: 'Bananas', sku: 'PRD-BANANA', unit: 'lb', currentStock: 6, minStock: 6, costPrice: '0.40', sellingPrice: '0.89', expirationDate: new Date(Date.now() + 4 * DAY_MS), supplierId: 4, categoryId: 4 },
  { id: 10, name: 'Bottled Water 500ml', sku: 'DRK-WATER-500', unit: 'bottle', currentStock: 50, minStock: 24, costPrice: '0.30', sellingPrice: '1.29', expirationDate: null, supplierId: 1, categoryId: 1 },
  { id: 11, name: 'Phone Charger', sku: 'HOU-CHARGER', unit: 'unit', currentStock: 10, minStock: 3, costPrice: '7.00', sellingPrice: '14.99', expirationDate: null, supplierId: 4, categoryId: 5 },
  { id: 12, name: 'Eggs (dozen)', sku: 'DAI-EGGS-12', unit: 'carton', currentStock: 12, minStock: 6, costPrice: '3.10', sellingPrice: '4.99', expirationDate: new Date(Date.now() + 14 * DAY_MS), supplierId: 2, categoryId: 2 },
];

// [productId, quantity, daysAgo]
const SALES: [number, number, number][] = [
  [1, 20, 0], [1, 15, 3], [1, 10, 12],
  [2, 12, 1], [2, 8, 5],
  [3, 9, 0], [3, 5, 4],
  [4, 6, 1], [4, 3, 6],
  [5, 4, 2], [5, 6, 20],
  [6, 15, 2], [6, 10, 9],
  [10, 25, 1], [10, 15, 8],
  [12, 8, 3],
  [7, 1, 60], [11, 1, 45],
];

export const FIXTURE_PRODUCT_NAMES = PRODUCTS.map((product) => product.name);

const MIN_STOCK_FIELD = { __field: 'minStock' };

interface DateRange {
  gte?: Date;
  lt?: Date;
}

// The subset of Prisma filters the insight service uses.
type Where =
  | {
      isActive?: boolean;
      currentStock?: { lte?: number | typeof MIN_STOCK_FIELD; gt?: number };
      id?: { in?: number[]; notIn?: number[] };
      productId?: { in?: number[] };
      createdAt?: DateRange;
      sale?: { createdAt?: DateRange };
    }
  | undefined;

interface Select {
  [key: string]: boolean | { select: Select } | undefined;
}

function hydrate(product: FixtureProduct) {
  return {
    ...product,
    isActive: true,
    barcode: null,
    costPrice: new Prisma.Decimal(product.costPrice),
    sellingPrice: new Prisma.Decimal(product.sellingPrice),
    supplier: SUPPLIERS.find((supplier) => supplier.id === product.supplierId),
    category: CATEGORIES.find((category) => category.id === product.categoryId),
  };
}

function pick(row: Record<string, unknown>, select?: Select) {
  if (!select) return row;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) continue;
    result[key] =
      typeof value === 'object' && row[key]
        ? pick(row[key] as Record<string, unknown>, value.select)
        : row[key];
  }
  return result;
}

function matchesProduct(product: ReturnType<typeof hydrate>, where: Where) {
  if (!where) return true;
  if (where.isActive !== undefined && product.isActive !== where.isActive) return false;
  const stock = where.currentStock;
  if (stock?.lte !== undefined) {
    const limit =
      typeof stock.lte === 'number' ? stock.lte : product.minStock;
    if (product.currentStock > limit) return false;
  }
  if (stock?.gt !== undefined && !(product.currentStock > stock.gt)) return false;
  if (where.id?.in && !where.id.in.includes(product.id)) return false;
  if (where.id?.notIn && where.id.notIn.includes(product.id)) return false;
  return true;
}

function salesRows(now: number) {
  return SALES.map(([productId, quantity, daysAgo], index) => {
    const product = PRODUCTS.find((item) => item.id === productId)!;
    return {
      id: index + 1,
      productId,
      quantity,
      lineTotal: new Prisma.Decimal(product.sellingPrice).times(quantity),
      createdAt: new Date(now - daysAgo * DAY_MS - 60_000),
    };
  });
}

function matchesSale(row: ReturnType<typeof salesRows>[number], where: Where) {
  if (!where) return true;
  if (where.productId?.in && !where.productId.in.includes(row.productId)) return false;
  const createdAt = where.sale?.createdAt ?? where.createdAt;
  if (createdAt?.gte && row.createdAt < createdAt.gte) return false;
  if (createdAt?.lt && row.createdAt >= createdAt.lt) return false;
  return true;
}

/**
 * An in-memory stand-in for the Prisma calls the insight service makes, so the
 * agent eval is hermetic and runs in CI without PostgreSQL.
 */
export function createFixturePrisma(): PrismaService {
  const now = Date.now();
  const products = PRODUCTS.map(hydrate);
  const sales = salesRows(now);

  const prisma = {
    product: {
      fields: { minStock: MIN_STOCK_FIELD },
      findMany: (args: { where?: Where; select?: Select; orderBy?: Record<string, 'asc' | 'desc'>; take?: number }) => {
        let rows = products.filter((product) => matchesProduct(product, args.where));
        if (args.orderBy?.currentStock) {
          const direction = args.orderBy.currentStock === 'asc' ? 1 : -1;
          rows = [...rows].sort((a, b) => direction * (a.currentStock - b.currentStock));
        }
        if (args.take) rows = rows.slice(0, args.take);
        return Promise.resolve(rows.map((row) => pick(row, args.select)));
      },
      count: (args: { where?: Where }) =>
        Promise.resolve(products.filter((product) => matchesProduct(product, args?.where)).length),
    },
    saleItem: {
      groupBy: (args: { where?: Where; orderBy?: { _sum?: { quantity?: 'asc' | 'desc' } }; take?: number }) => {
        const totals = new Map<number, { quantity: number; lineTotal: Prisma.Decimal }>();
        for (const row of sales.filter((sale) => matchesSale(sale, args.where))) {
          const total = totals.get(row.productId) ?? { quantity: 0, lineTotal: new Prisma.Decimal(0) };
          totals.set(row.productId, {
            quantity: total.quantity + row.quantity,
            lineTotal: total.lineTotal.plus(row.lineTotal),
          });
        }
        let rows = [...totals.entries()].map(([productId, sum]) => ({ productId, _sum: sum }));
        if (args.orderBy?._sum?.quantity) {
          const direction = args.orderBy._sum.quantity === 'asc' ? 1 : -1;
          rows.sort((a, b) => direction * (a._sum.quantity - b._sum.quantity));
        }
        if (args.take) rows = rows.slice(0, args.take);
        return Promise.resolve(rows);
      },
      findMany: (args: { where?: Where }) => {
        const ids = new Set(sales.filter((sale) => matchesSale(sale, args.where)).map((sale) => sale.productId));
        return Promise.resolve([...ids].map((productId) => ({ productId })));
      },
    },
    sale: {
      count: (args: { where?: Where }) =>
        Promise.resolve(sales.filter((sale) => matchesSale(sale, args?.where)).length),
    },
    aiInsightLog: {
      create: () => Promise.resolve({ id: 1 }),
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  };

  return prisma as unknown as PrismaService;
}
