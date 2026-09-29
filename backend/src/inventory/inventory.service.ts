import { BadRequestException, Injectable } from '@nestjs/common';
import { calendarDate, dateRange, storeDate } from '../store-operations/common';
import { consumeStock, receiveStock } from '../store-operations/stock';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import {
  QueryInventoryMovementsDto,
  InventoryMovementSortField,
} from './dto/query-inventory-movements.dto';
import { StockInDto } from './dto/stock-in.dto';
import { WasteStockDto } from './dto/waste-stock.dto';

const movementInclude = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      currentStock: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
    },
  },
} satisfies Prisma.InventoryMovementInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getInventoryMovements(query: QueryInventoryMovementsDto) {
    const {
      sortField = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20,
    } = query;

    const where = this.buildWhere(query);
    const [total, list] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: this.buildOrderBy(sortField, sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(
    field: string,
    query: QueryInventoryMovementsDto,
  ): Promise<string[]> {
    const where = this.buildWhere(query, field);

    switch (field) {
      case 'type': {
        const rows = await this.prisma.inventoryMovement.findMany({
          where,
          select: { type: true },
          orderBy: { type: 'asc' },
        });
        return [...new Set(rows.map((row) => row.type))];
      }
      case 'productName': {
        const rows = await this.prisma.inventoryMovement.findMany({
          where,
          select: { product: { select: { name: true } } },
        });
        return [...new Set(rows.map((row) => row.product.name))].sort();
      }
      case 'createdAt': {
        const rows = await this.prisma.inventoryMovement.findMany({
          where,
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
        return [...new Set(rows.map((row) => storeDate(row.createdAt)))];
      }
      default:
        return [];
    }
  }

  async stockIn(data: StockInDto, operator: { id: number; email: string }) {
    const quantity = this.normalizePositiveInteger(data.quantity, 'quantity');
    const reason = this.normalizeOptionalString(data.reason);
    const referenceType = this.normalizeOptionalString(data.referenceType);
    const referenceId = this.normalizeOptionalInteger(
      data.referenceId,
      'referenceId',
    );
    const unitCost = this.normalizeDecimal(data.unitCost, 'unitCost', true);

    return this.applyMovement(
      {
        productId: data.productId,
        batchId: data.batchId,
        lotCode: data.lotCode,
        expirationDate: data.expirationDate,
        quantityDelta: quantity,
        movementType: InventoryMovementType.purchase,
        reason,
        referenceType,
        referenceId,
        unitCost,
        auditField: 'stock_in',
      },
      operator,
    );
  }

  async adjustStock(
    data: AdjustStockDto,
    operator: { id: number; email: string },
  ) {
    const quantityDelta = this.normalizeNonZeroInteger(
      data.quantity,
      'quantity',
    );
    const reason = this.normalizeOptionalString(data.reason);
    const referenceType = this.normalizeOptionalString(data.referenceType);
    const referenceId = this.normalizeOptionalInteger(
      data.referenceId,
      'referenceId',
    );

    return this.applyMovement(
      {
        productId: data.productId,
        batchId: data.batchId,
        lotCode: data.lotCode,
        expirationDate: data.expirationDate,
        quantityDelta,
        movementType: InventoryMovementType.adjustment,
        reason,
        referenceType,
        referenceId,
        auditField: 'stock_adjustment',
      },
      operator,
    );
  }

  async wasteStock(
    data: WasteStockDto,
    operator: { id: number; email: string },
  ) {
    const quantity = this.normalizePositiveInteger(data.quantity, 'quantity');
    const reason = this.normalizeOptionalString(data.reason);
    const referenceType = this.normalizeOptionalString(data.referenceType);
    const referenceId = this.normalizeOptionalInteger(
      data.referenceId,
      'referenceId',
    );

    return this.applyMovement(
      {
        productId: data.productId,
        batchId: data.batchId,
        lotCode: data.lotCode,
        expirationDate: data.expirationDate,
        quantityDelta: -quantity,
        movementType: InventoryMovementType.waste,
        reason,
        referenceType,
        referenceId,
        auditField: 'stock_waste',
      },
      operator,
    );
  }

  async getLowStockProducts() {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: {
          lte: this.prisma.product.fields.minStock,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        currentStock: true,
        minStock: true,
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ currentStock: 'asc' }, { name: 'asc' }],
    });
  }

  async getExpirationAlerts(days = 7) {
    if (!Number.isInteger(days) || days < 0 || days > 365)
      throw new BadRequestException('days must be 0–365');
    const today = calendarDate(storeDate());
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        quantityRemaining: { gt: 0 },
        expirationDate: { lte: new Date(today.getTime() + days * 86400000) },
        product: { isActive: true },
      },
      include: { product: { include: { supplier: true, category: true } } },
      orderBy: { expirationDate: 'asc' },
    });
    return batches.map((batch) => ({
      ...batch.product,
      id: batch.id,
      productId: batch.productId,
      batchId: batch.id,
      lotCode: batch.lotCode,
      currentStock: batch.quantityRemaining,
      expirationDate: batch.expirationDate,
      daysUntilExpiration: Math.round(
        (batch.expirationDate!.getTime() - today.getTime()) / 86400000,
      ),
      status: batch.expirationDate! < today ? 'expired' : 'expiring_soon',
    }));
  }

  private async applyMovement(
    input: {
      productId: number;
      quantityDelta: number;
      movementType: InventoryMovementType;
      reason?: string | null;
      referenceType?: string | null;
      referenceId?: number | null;
      unitCost?: Prisma.Decimal | null;
      auditField: string;
      batchId?: number;
      lotCode?: string;
      expirationDate?: string | null;
    },
    operator: { id: number; email: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      let id: number;
      if (input.quantityDelta > 0) {
        const result = await receiveStock(
          tx,
          { ...input, quantity: input.quantityDelta, type: input.movementType },
          operator,
        );
        id = result.movement.id;
      } else {
        const result = await consumeStock(
          tx,
          {
            ...input,
            quantity: -input.quantityDelta,
            type: input.movementType,
          },
          operator,
        );
        id = result.movements[0];
      }
      return tx.inventoryMovement.findUniqueOrThrow({
        where: { id },
        include: movementInclude,
      });
    });
  }

  private buildWhere(
    query: QueryInventoryMovementsDto,
    excludedField?: string,
  ): Prisma.InventoryMovementWhereInput {
    const and: Prisma.InventoryMovementWhereInput[] = [];

    if (query.productName) {
      and.push({
        product: {
          name: { contains: query.productName, mode: 'insensitive' },
        },
      });
    }

    if (excludedField !== 'type' && query.filterTypes) {
      const types = query.filterTypes
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is InventoryMovementType =>
          Object.values(InventoryMovementType).includes(
            value as InventoryMovementType,
          ),
        );
      if (types.length) {
        and.push({ type: { in: types } });
      }
    }

    if (excludedField !== 'productName' && query.filterProductNames) {
      const names = query.filterProductNames
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (names.length) {
        and.push({ product: { name: { in: names } } });
      }
    }

    if (excludedField !== 'createdAt' && query.filterCreatedDates) {
      const dates = query.filterCreatedDates
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((date) => {
            const { start, end } = dateRange(date);
            return { createdAt: { gte: start, lt: end } };
          }),
        });
      }
    }

    return and.length ? { AND: and } : {};
  }

  private buildOrderBy(
    sortField: InventoryMovementSortField,
    sortOrder: 'asc' | 'desc',
  ): Prisma.InventoryMovementOrderByWithRelationInput {
    return { [sortField]: sortOrder };
  }

  private normalizePositiveInteger(value: number, field: string) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return value;
  }

  private normalizeNonZeroInteger(value: number, field: string) {
    if (!Number.isInteger(value) || value === 0) {
      throw new BadRequestException(`${field} must be a non-zero integer`);
    }
    return value;
  }

  private normalizeOptionalInteger(
    value: number | null | undefined,
    field: string,
  ) {
    if (value === undefined || value === null) {
      return value ?? null;
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
    return value;
  }

  private normalizeOptionalString(value?: string | null) {
    if (value === undefined || value === null) {
      return value ?? null;
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  private normalizeDecimal(
    value: number | string | null | undefined,
    field: string,
    allowEmpty = false,
  ) {
    if (value === undefined || value === null || value === '') {
      if (allowEmpty) {
        return null;
      }
      throw new BadRequestException(`${field} is required`);
    }

    const decimal = new Prisma.Decimal(value);
    if (decimal.isNegative()) {
      throw new BadRequestException(`${field} must be zero or greater`);
    }
    return decimal;
  }
}
