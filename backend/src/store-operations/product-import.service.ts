import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  amount,
  audit,
  calendarDate,
  hash,
  integer,
  lockKey,
  Operator,
  requestKey,
} from './common';
import { receiveStock } from './stock';

const HEADERS = [
  'name',
  'sku',
  'barcode',
  'category',
  'supplier',
  'unit',
  'costPrice',
  'sellingPrice',
  'currentStock',
  'minStock',
  'expirationTracked',
  'expirationDate',
  'lotCode',
];
type ImportRow = {
  row: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string;
  supplier: string;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  currentStock: number;
  minStock: number;
  expirationTracked: boolean;
  expirationDate: string;
  lotCode: string;
};

@Injectable()
export class ProductImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(csv: string, db: Prisma.TransactionClient = this.prisma) {
    if (
      typeof csv !== 'string' ||
      !csv.trim() ||
      Buffer.byteLength(csv, 'utf8') > 1024 * 1024
    )
      throw new BadRequestException('Upload a UTF-8 CSV of at most 1 MB');
    let rows: Record<string, string>[];
    try {
      rows = parse(csv, {
        bom: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 10000,
        columns: (headers: string[]) => {
          if (
            new Set(headers).size !== headers.length ||
            headers.some((h) => !HEADERS.includes(h)) ||
            !['name', 'costPrice', 'sellingPrice'].every((h) =>
              headers.includes(h),
            )
          )
            throw new Error(
              'Use the template headers; name, costPrice and sellingPrice are required',
            );
          return headers;
        },
      }) as Record<string, string>[];
    } catch (error) {
      throw new BadRequestException(
        `Invalid CSV: ${error instanceof Error ? error.message : 'parse error'}`,
      );
    }
    if (rows.length < 1 || rows.length > 500)
      throw new BadRequestException('CSV must contain 1–500 product rows');
    const errors: { row: number; message: string }[] = [];
    const products: ImportRow[] = [];
    const skus = new Set<string>();
    const barcodes = new Set<string>();
    for (const [index, row] of rows.entries()) {
      try {
        if (!row.name?.trim() || row.name.length > 200)
          throw new Error('Product name is required (max 200 characters)');
        const sku = row.sku?.trim() || null;
        const barcode = row.barcode?.trim() || null;
        if (!sku && !barcode) throw new Error('Provide SKU or barcode');
        if ((sku && skus.has(sku)) || (barcode && barcodes.has(barcode)))
          throw new Error('Duplicate SKU or barcode within the file');
        if ((sku?.length ?? 0) > 100 || (barcode?.length ?? 0) > 100)
          throw new Error('SKU/barcode too long');
        if (sku) skus.add(sku);
        if (barcode) barcodes.add(barcode);
        if (
          row.expirationTracked &&
          !['true', 'false'].includes(row.expirationTracked.toLowerCase())
        )
          throw new Error('expirationTracked must be true or false');
        const expirationTracked =
          row.expirationTracked?.toLowerCase() === 'true';
        const currentStock = integer(Number(row.currentStock || 0), true);
        const expiry = row.expirationDate?.trim() || '';
        if (expiry) calendarDate(expiry);
        if (expirationTracked && currentStock > 0 && !expiry)
          throw new Error('Opening tracked stock requires expirationDate');
        products.push({
          row: index + 2,
          name: row.name.trim(),
          sku,
          barcode,
          category: row.category?.trim() || '',
          supplier: row.supplier?.trim() || '',
          unit: row.unit?.trim() || 'unit',
          costPrice: amount(row.costPrice).toFixed(2),
          sellingPrice: amount(row.sellingPrice).toFixed(2),
          currentStock,
          minStock: integer(Number(row.minStock || 0), true),
          expirationTracked,
          expirationDate: expiry,
          lotCode: row.lotCode?.trim() || '',
        });
      } catch (error) {
        errors.push({
          row: index + 2,
          message: error instanceof Error ? error.message : 'Invalid row',
        });
      }
    }
    const existing = await db.product.findMany({
      where: {
        OR: [{ sku: { in: [...skus] } }, { barcode: { in: [...barcodes] } }],
      },
      select: { sku: true, barcode: true },
    });
    for (const p of products)
      if (
        existing.some(
          (e) =>
            (p.sku && p.sku === e.sku) ||
            (p.barcode && p.barcode === e.barcode),
        )
      )
        errors.push({
          row: p.row,
          message:
            'SKU/barcode already exists. Import creates new products only.',
        });
    return {
      fileHash: hash(csv),
      rowCount: rows.length,
      products,
      errors,
      canImport: errors.length === 0,
    };
  }

  async commit(
    input: { csv: string; fileHash: string; requestId: string },
    operator: Operator,
  ) {
    const key = requestKey(input.requestId);
    if (typeof input.csv !== 'string' || hash(input.csv) !== input.fileHash)
      throw new BadRequestException(
        'File changed after preview; preview again',
      );
    return this.prisma.$transaction(
      async (tx) => {
        await lockKey(tx, 'product-import');
        const previous = await tx.productImport.findUnique({
          where: { requestId: key },
        });
        if (previous) {
          if (
            previous.fileHash !== input.fileHash ||
            previous.userId !== operator.id
          )
            throw new ConflictException('Request ID already used');
          return previous;
        }
        const preview = await this.preview(input.csv, tx);
        if (!preview.canImport)
          throw new BadRequestException({
            message: 'Nothing imported. Resolve all errors and preview again.',
            errors: preview.errors,
          });
        for (const row of preview.products) {
          const category = row.category
            ? await tx.category.upsert({
                where: { name: row.category },
                create: { name: row.category },
                update: {},
              })
            : null;
          const supplier = row.supplier
            ? await tx.supplier.upsert({
                where: { name: row.supplier },
                create: { name: row.supplier },
                update: {},
              })
            : null;
          const product = await tx.product.create({
            data: {
              name: row.name,
              sku: row.sku,
              barcode: row.barcode,
              unit: row.unit,
              costPrice: row.costPrice,
              sellingPrice: row.sellingPrice,
              minStock: row.minStock,
              expirationTracked: row.expirationTracked,
              categoryId: category?.id,
              supplierId: supplier?.id,
              createdById: operator.id,
            },
          });
          if (row.currentStock)
            await receiveStock(
              tx,
              {
                productId: product.id,
                quantity: row.currentStock,
                lotCode: row.lotCode,
                expirationDate: row.expirationDate,
                unitCost: row.costPrice,
                reason: 'CSV opening stock',
                referenceType: 'csv_import',
              },
              operator,
            );
        }
        const record = await tx.productImport.create({
          data: {
            requestId: key,
            fileHash: input.fileHash,
            userId: operator.id,
            count: preview.rowCount,
          },
        });
        await audit(tx, operator, 'product_imports', record.id, 'imported', {
          count: record.count,
          fileHash: record.fileHash,
        });
        return record;
      },
      { timeout: 60000 },
    );
  }
}
