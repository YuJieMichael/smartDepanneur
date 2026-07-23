import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryInventoryMovementsDto, InventoryMovementSortField } from './dto/query-inventory-movements.dto';
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

  async getFilterOptions(field: string, query: QueryInventoryMovementsDto): Promise<string[]> {
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
        return [...new Set(rows.map((row) => row.createdAt.toISOString().split('T')[0]))];
      }
      default:
        return [];
    }
  }

  async stockIn(data: StockInDto, operator: { id: number; email: string }) {
    const quantity = this.normalizePositiveInteger(data.quantity, 'quantity');
    const reason = this.normalizeOptionalString(data.reason);
    const referenceType = this.normalizeOptionalString(data.referenceType);
    const referenceId = this.normalizeOptionalInteger(data.referenceId, 'referenceId');
    const unitCost = this.normalizeDecimal(data.unitCost, 'unitCost', true);

    return this.applyMovement(
      {
        productId: data.productId,
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

  async adjustStock(data: AdjustStockDto, operator: { id: number; email: string }) {
    const quantityDelta = this.normalizeNonZeroInteger(data.quantity, 'quantity');
    const reason = this.normalizeOptionalString(data.reason);
    const referenceType = this.normalizeOptionalString(data.referenceType);
    const referenceId = this.normalizeOptionalInteger(data.referenceId, 'referenceId');

    return this.applyMovement(
      {
        productId: data.productId,
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

  async wasteStock(data: WasteStockDto, operator: { id: number; email: string }) {
    const quantity = this.normalizePositiveInteger(data.quantity, 'quantity');
    const reason = this.normalizeOptionalString(data.reason);
    const referenceType = this.normalizeOptionalString(data.referenceType);
    const referenceId = this.normalizeOptionalInteger(data.referenceId, 'referenceId');

    return this.applyMovement(
      {
        productId: data.productId,
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
      orderBy: [
        { currentStock: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async getExpirationAlerts(days = 7) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const soonEnd = new Date(todayStart.getTime() + days * 86400000);

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        expirationTracked: true,
        expirationDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        currentStock: true,
        expirationDate: true,
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    return products
      .map((product) => {
        const expirationDate = product.expirationDate!;
        const daysUntilExpiration = Math.ceil(
          (expirationDate.getTime() - todayStart.getTime()) / 86400000,
        );
        const status =
          daysUntilExpiration < 0
            ? 'expired'
            : expirationDate <= soonEnd
              ? 'expiring_soon'
              : 'safe';

        return {
          ...product,
          daysUntilExpiration,
          status,
        };
      })
      .filter((product) => product.status !== 'safe');
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
    },
    operator: { id: number; email: string },
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true, name: true, currentStock: true },
      });

      if (!product) {
        throw new NotFoundException(`Product ${input.productId} not found`);
      }

      const stockCondition =
        input.quantityDelta < 0
          ? { gte: Math.abs(input.quantityDelta) }
          : undefined;
      const updateResult = await tx.product.updateMany({
        where: {
          id: product.id,
          ...(stockCondition ? { currentStock: stockCondition } : {}),
        },
        data: {
          currentStock:
            input.quantityDelta > 0
              ? { increment: input.quantityDelta }
              : { decrement: Math.abs(input.quantityDelta) },
        },
      });

      if (updateResult.count !== 1) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}`,
        );
      }

      const updatedProduct = await tx.product.findUniqueOrThrow({
        where: { id: product.id },
        select: { id: true, name: true, currentStock: true },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          type: input.movementType,
          quantity: input.quantityDelta,
          unitCost: input.unitCost,
          reason: input.reason,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          product: { connect: { id: product.id } },
          user: { connect: { id: operator.id } },
        },
        include: movementInclude,
      });

      return {
        previousStock: updatedProduct.currentStock - input.quantityDelta,
        product: updatedProduct,
        movement,
      };
    });

    await Promise.all([
      this.auditTrailService.create({
        table: 'products',
        recordId: result.product.id,
        field: 'currentStock',
        oldValue: String(result.previousStock),
        newValue: String(result.product.currentStock),
        userId: operator.id,
        userEmail: operator.email,
      }),
      this.auditTrailService.create({
        table: 'inventory_movements',
        recordId: result.movement.id,
        field: input.auditField,
        oldValue: null,
        newValue: `${result.movement.product.name}: ${result.movement.quantity}`,
        userId: operator.id,
        userEmail: operator.email,
      }),
    ]);

    return result.movement;
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
        .filter((value): value is InventoryMovementType => Object.values(InventoryMovementType).includes(value as InventoryMovementType));
      if (types.length) {
        and.push({ type: { in: types } });
      }
    }

    if (excludedField !== 'productName' && query.filterProductNames) {
      const names = query.filterProductNames.split(',').map((value) => value.trim()).filter(Boolean);
      if (names.length) {
        and.push({ product: { name: { in: names } } });
      }
    }

    if (excludedField !== 'createdAt' && query.filterCreatedDates) {
      const dates = query.filterCreatedDates.split(',').map((value) => value.trim()).filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((date) => {
            const start = new Date(`${date}T00:00:00.000Z`);
            const end = new Date(start.getTime() + 86400000);
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

  private normalizeOptionalInteger(value: number | null | undefined, field: string) {
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
