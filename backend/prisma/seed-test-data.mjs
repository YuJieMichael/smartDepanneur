import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TAX_RATE = 0.14975;

function addDays(days) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function ensureUser(email, roleName) {
  const password = await bcrypt.hash('123456', 10);
  return prisma.user.upsert({
    where: { email },
    update: {
      password,
      roles: { set: [{ name: roleName }] },
    },
    create: {
      email,
      password,
      roles: { connect: { name: roleName } },
    },
  });
}

async function main() {
  if (await prisma.stockBatch.count()) {
    console.log('Demo seeding skipped: batch inventory already exists.');
    return;
  }
  const admin = await ensureUser('owner@smartdepanneur.local', 'Store Owner');
  await ensureUser('cashier@smartdepanneur.local', 'Cashier');
  await ensureUser('inventory@smartdepanneur.local', 'Inventory Staff');

  const categories = [
    { name: 'Drinks', code: 'DRINKS' },
    { name: 'Snacks', code: 'SNACKS' },
    { name: 'Dairy', code: 'DAIRY' },
    { name: 'Household', code: 'HOUSEHOLD' },
    { name: 'OTC', code: 'OTC' },
    { name: 'Lottery', code: 'LOTTERY' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { code: category.code },
      create: category,
    });
  }

  const suppliers = [
    {
      name: 'Metro Beverage Supply',
      contactName: 'Martin Roy',
      phone: '514-555-0101',
      email: 'orders@metrobeverage.example',
      notes: 'Weekly beverage restocking supplier',
    },
    {
      name: 'QuickSnack Wholesale',
      contactName: 'Nina Chen',
      phone: '514-555-0102',
      email: 'sales@quicksnack.example',
      notes: 'Snacks and impulse-purchase items',
    },
    {
      name: 'Nordic Dairy Distributors',
      contactName: 'Alex Gagnon',
      phone: '514-555-0103',
      email: 'dispatch@nordicdairy.example',
      notes: 'Short-shelf-life refrigerated products',
    },
    {
      name: 'Local Essentials Depot',
      contactName: 'Sam Patel',
      phone: '514-555-0104',
      email: 'orders@essentials.example',
      notes: 'Household and OTC products',
    },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { name: supplier.name },
      update: supplier,
      create: supplier,
    });
  }

  const categoryMap = new Map(
    (await prisma.category.findMany()).map((category) => [category.name, category.id]),
  );
  const supplierMap = new Map(
    (await prisma.supplier.findMany()).map((supplier) => [supplier.name, supplier.id]),
  );

  const products = [
    {
      name: 'Coca-Cola 355ml',
      barcode: '00049000028911',
      sku: 'DRK-COKE-355',
      unit: 'can',
      currentStock: 9,
      minStock: 24,
      costPrice: '0.78',
      sellingPrice: '1.79',
      category: 'Drinks',
      supplier: 'Metro Beverage Supply',
    },
    {
      name: 'Red Bull 250ml',
      barcode: '090478391012',
      sku: 'DRK-RB-250',
      unit: 'can',
      currentStock: 4,
      minStock: 18,
      costPrice: '1.85',
      sellingPrice: '3.99',
      category: 'Drinks',
      supplier: 'Metro Beverage Supply',
    },
    {
      name: '2% Milk 1L',
      barcode: '068700100011',
      sku: 'DRY-MILK-1L',
      unit: 'carton',
      currentStock: 6,
      minStock: 8,
      costPrice: '2.15',
      sellingPrice: '3.49',
      expirationTracked: true,
      expirationDate: addDays(4),
      category: 'Dairy',
      supplier: 'Nordic Dairy Distributors',
    },
    {
      name: 'Turkey Sandwich',
      barcode: '777000120001',
      sku: 'DRY-SAND-TURKEY',
      unit: 'unit',
      currentStock: 3,
      minStock: 6,
      costPrice: '3.25',
      sellingPrice: '6.49',
      expirationTracked: true,
      expirationDate: addDays(1),
      category: 'Dairy',
      supplier: 'Nordic Dairy Distributors',
    },
    {
      name: 'Lay Chips Original 235g',
      barcode: '060410046720',
      sku: 'SNK-LAY-235',
      unit: 'bag',
      currentStock: 32,
      minStock: 12,
      costPrice: '2.10',
      sellingPrice: '4.29',
      category: 'Snacks',
      supplier: 'QuickSnack Wholesale',
    },
    {
      name: 'Chocolate Bar',
      barcode: '061200110011',
      sku: 'SNK-CHOC-BAR',
      unit: 'bar',
      currentStock: 46,
      minStock: 20,
      costPrice: '0.92',
      sellingPrice: '1.99',
      category: 'Snacks',
      supplier: 'QuickSnack Wholesale',
    },
    {
      name: 'AA Batteries 4-pack',
      barcode: '055000330044',
      sku: 'HOU-AA-4PK',
      unit: 'pack',
      currentStock: 14,
      minStock: 6,
      costPrice: '3.80',
      sellingPrice: '7.99',
      category: 'Household',
      supplier: 'Local Essentials Depot',
    },
    {
      name: 'Ibuprofen 200mg 24ct',
      barcode: '066000220010',
      sku: 'OTC-IBU-24',
      unit: 'box',
      currentStock: 2,
      minStock: 5,
      costPrice: '4.35',
      sellingPrice: '8.99',
      expirationTracked: true,
      expirationDate: addDays(35),
      category: 'OTC',
      supplier: 'Local Essentials Depot',
    },
    {
      name: 'Scratch Ticket $5',
      barcode: 'LOTTERY-5',
      sku: 'LOT-SCRATCH-5',
      unit: 'ticket',
      currentStock: 100,
      minStock: 40,
      costPrice: '5.00',
      sellingPrice: '5.00',
      category: 'Lottery',
      supplier: 'Local Essentials Depot',
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        currentStock: product.currentStock,
        minStock: product.minStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        expirationTracked: product.expirationTracked ?? false,
        expirationDate: product.expirationDate ?? null,
        isActive: true,
        categoryId: categoryMap.get(product.category),
        supplierId: supplierMap.get(product.supplier),
        createdById: admin.id,
      },
      create: {
        name: product.name,
        barcode: product.barcode,
        sku: product.sku,
        unit: product.unit,
        currentStock: product.currentStock,
        minStock: product.minStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        expirationTracked: product.expirationTracked ?? false,
        expirationDate: product.expirationDate ?? null,
        isActive: true,
        categoryId: categoryMap.get(product.category),
        supplierId: supplierMap.get(product.supplier),
        createdById: admin.id,
      },
    });
  }

  const existingDemoSales = await prisma.sale.findMany({
    where: { saleNumber: { startsWith: 'DEMO-' } },
    select: { id: true },
  });

  if (existingDemoSales.length > 0) {
    const saleIds = existingDemoSales.map((sale) => sale.id);
    await prisma.inventoryMovement.deleteMany({
      where: {
        referenceType: { in: ['sale', 'sale_void'] },
        referenceId: { in: saleIds },
      },
    });
    await prisma.auditTrail.deleteMany({
      where: { table: 'sales', recordId: { in: saleIds } },
    });
    await prisma.sale.deleteMany({
      where: { id: { in: saleIds } },
    });
  }

  {
    const productRows = await prisma.product.findMany({
      where: { sku: { in: products.map((product) => product.sku) } },
    });
    const productMap = new Map(productRows.map((product) => [product.sku, product]));

    const demoSales = [
      {
        saleNumber: 'DEMO-001',
        paymentMethod: 'debit',
        items: [
          { sku: 'DRK-COKE-355', quantity: 5 },
          { sku: 'SNK-CHOC-BAR', quantity: 3 },
        ],
      },
      {
        saleNumber: 'DEMO-002',
        paymentMethod: 'cash',
        items: [
          { sku: 'DRK-RB-250', quantity: 4 },
          { sku: 'SNK-LAY-235', quantity: 2 },
        ],
      },
      {
        saleNumber: 'DEMO-003',
        paymentMethod: 'credit',
        items: [
          { sku: 'DRY-MILK-1L', quantity: 2 },
          { sku: 'DRY-SAND-TURKEY', quantity: 1 },
          { sku: 'HOU-AA-4PK', quantity: 1 },
        ],
      },
    ];

    for (const saleSeed of demoSales) {
      const resolvedItems = saleSeed.items.map((item) => {
        const product = productMap.get(item.sku);
        if (!product) throw new Error(`Missing product ${item.sku}`);
        return {
          product,
          quantity: item.quantity,
          lineTotal: product.sellingPrice.mul(item.quantity),
          lineProfit: product.sellingPrice.sub(product.costPrice).mul(item.quantity),
        };
      });

      const subtotalDecimal = resolvedItems.reduce(
        (sum, item) => sum.add(item.lineTotal),
        new Prisma.Decimal(0),
      );
      const tax = subtotalDecimal.mul(TAX_RATE).toDecimalPlaces(2);
      const total = subtotalDecimal.add(tax);
      const profit = resolvedItems.reduce(
        (sum, item) => sum.add(item.lineProfit),
        new Prisma.Decimal(0),
      );

      const sale = await prisma.sale.create({
        data: {
          saleNumber: saleSeed.saleNumber,
          subtotal: subtotalDecimal,
          tax,
          total,
          profitEstimate: profit,
          paymentMethod: saleSeed.paymentMethod,
          cashierId: admin.id,
          items: {
            create: resolvedItems.map((item) => ({
              quantity: item.quantity,
              unitPrice: item.product.sellingPrice,
              unitCost: item.product.costPrice,
              lineTotal: item.lineTotal,
              productId: item.product.id,
            })),
          },
        },
      });

      for (const item of resolvedItems) {
        await prisma.product.update({
          where: { id: item.product.id },
          data: { currentStock: { decrement: item.quantity } },
        });
        await prisma.inventoryMovement.create({
          data: {
            type: 'sale',
            quantity: -item.quantity,
            unitCost: item.product.costPrice,
            reason: `Sale ${sale.saleNumber}`,
            referenceType: 'sale',
            referenceId: sale.id,
            productId: item.product.id,
            userId: admin.id,
          },
        });
      }
    }
  }

  const openingProducts = await prisma.product.findMany({ where: { currentStock: { gt: 0 } } });
  for (const product of openingProducts) await prisma.stockBatch.create({ data: { productId: product.id, lotCode: 'DEMO-OPENING-' + product.id, quantityReceived: product.currentStock, quantityRemaining: product.currentStock, unitCost: product.costPrice, expirationDate: product.expirationDate } });
  await prisma.$executeRaw`UPDATE sale_items si SET category_id_snapshot = p.category_id, category_name_snapshot = COALESCE(c.name, 'Uncategorized'), cost_total = COALESCE(si.unit_cost, 0) * si.quantity FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE si.product_id = p.id AND si.cost_total IS NULL`;
  console.log('Seeded SmartDepanneur demo users, products, inventory, and sales.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
