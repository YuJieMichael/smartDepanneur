import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto, ProductSortField } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productInclude = {
  category: { select: { id: true, name: true, code: true } },
  supplier: { select: { id: true, name: true, contactName: true } },
  createdBy: { select: { id: true, email: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

type NormalizedUpdateInput = {
  data: Prisma.ProductUpdateInput;
  categoryId?: number | null;
  supplierId?: number | null;
  barcode?: string | null;
  sku?: string | null;
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getProducts(query: QueryProductsDto) {
    const {
      sortField = 'id',
      sortOrder = 'asc',
      page = 1,
      pageSize = 20,
    } = query;

    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(sortField, sortOrder);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(field: string, query: QueryProductsDto): Promise<string[]> {
    const where = this.buildWhere(query, field);

    switch (field) {
      case 'id': {
        const rows = await this.prisma.product.findMany({
          where,
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        return rows.map((row) => String(row.id));
      }
      case 'name': {
        const rows = await this.prisma.product.findMany({
          where,
          select: { name: true },
          orderBy: { name: 'asc' },
        });
        return [...new Set(rows.map((row) => row.name))];
      }
      case 'category': {
        const rows = await this.prisma.product.findMany({
          where,
          select: { category: { select: { name: true } } },
        });
        return [...new Set(rows.map((row) => row.category?.name).filter(Boolean) as string[])].sort();
      }
      case 'supplier': {
        const rows = await this.prisma.product.findMany({
          where,
          select: { supplier: { select: { name: true } } },
        });
        return [...new Set(rows.map((row) => row.supplier?.name).filter(Boolean) as string[])].sort();
      }
      case 'isActive': {
        const rows = await this.prisma.product.findMany({
          where,
          select: { isActive: true },
          orderBy: { isActive: 'desc' },
        });
        return [...new Set(rows.map((row) => String(row.isActive)))];
      }
      case 'createdAt': {
        const rows = await this.prisma.product.findMany({
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

  async findById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  async createProduct(
    data: CreateProductDto,
    operator: { id: number; email: string },
  ) {
    await this.assertRelationsExist(data.categoryId, data.supplierId);
    await this.assertUniqueFields(
      this.normalizeOptionalString(data.barcode),
      this.normalizeOptionalString(data.sku),
    );

    const normalized = this.normalizeCreateInput(data);

    const product = await this.prisma.product.create({
      data: {
        ...normalized,
        createdBy: { connect: { id: operator.id } },
      },
      include: productInclude,
    });

    await this.auditTrailService.create({
      table: 'products',
      recordId: product.id,
      field: '[created]',
      oldValue: null,
      newValue: product.name,
      userId: operator.id,
      userEmail: operator.email,
    });

    return product;
  }

  async updateProduct(
    id: number,
    data: UpdateProductDto,
    operator: { id: number; email: string },
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    const normalized = this.normalizeUpdateInput(data);

    await this.assertRelationsExist(normalized.categoryId, normalized.supplierId);
    await this.assertUniqueFields(normalized.barcode, normalized.sku, id);

    const product = await this.prisma.product.update({
      where: { id },
      data: normalized.data,
      include: productInclude,
    });

    await this.recordUpdateAudits(existing, product, operator);

    return product;
  }

  async deleteProduct(
    id: number,
    operator: { id: number; email: string },
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    await this.prisma.product.delete({ where: { id } });

    await this.auditTrailService.create({
      table: 'products',
      recordId: id,
      field: '[deleted]',
      oldValue: existing.name,
      newValue: null,
      userId: operator.id,
      userEmail: operator.email,
    });

    return { success: true };
  }

  private buildWhere(
    query: QueryProductsDto,
    excludedField?: string,
  ): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [];

    if (query.name) {
      and.push({ name: { contains: query.name, mode: 'insensitive' } });
    }

    if (excludedField !== 'id' && query.filterIds) {
      const ids = query.filterIds.split(',').map(Number).filter(Boolean);
      if (ids.length) {
        and.push({ id: { in: ids } });
      }
    }

    if (excludedField !== 'name' && query.filterNames) {
      const names = query.filterNames.split(',').map((value) => value.trim()).filter(Boolean);
      if (names.length) {
        and.push({ name: { in: names } });
      }
    }

    if (excludedField !== 'category' && query.filterCategories) {
      const categories = query.filterCategories.split(',').map((value) => value.trim()).filter(Boolean);
      if (categories.length) {
        and.push({ category: { is: { name: { in: categories } } } });
      }
    }

    if (excludedField !== 'supplier' && query.filterSuppliers) {
      const suppliers = query.filterSuppliers.split(',').map((value) => value.trim()).filter(Boolean);
      if (suppliers.length) {
        and.push({ supplier: { is: { name: { in: suppliers } } } });
      }
    }

    if (excludedField !== 'isActive' && query.filterActive) {
      const activeValues = [...new Set(
        query.filterActive
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value === 'true' || value === 'false'),
      )];

      if (activeValues.length === 1) {
        and.push({ isActive: activeValues[0] === 'true' });
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
    sortField: ProductSortField,
    sortOrder: 'asc' | 'desc',
  ): Prisma.ProductOrderByWithRelationInput {
    return { [sortField]: sortOrder };
  }

  private normalizeCreateInput(data: CreateProductDto): Prisma.ProductCreateInput {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('Product name is required');
    }

    if (data.costPrice === undefined || data.sellingPrice === undefined) {
      throw new BadRequestException('Cost price and selling price are required');
    }

    return {
      name,
      barcode: this.normalizeOptionalString(data.barcode),
      sku: this.normalizeOptionalString(data.sku),
      unit: data.unit?.trim() || 'unit',
      currentStock: this.normalizeInteger(data.currentStock, 'currentStock', 0),
      minStock: this.normalizeInteger(data.minStock, 'minStock', 0),
      costPrice: this.normalizeDecimal(data.costPrice, 'costPrice'),
      sellingPrice: this.normalizeDecimal(data.sellingPrice, 'sellingPrice'),
      expirationTracked: data.expirationTracked ?? false,
      expirationDate: this.normalizeDate(data.expirationDate),
      isActive: data.isActive ?? true,
      category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
      supplier: data.supplierId ? { connect: { id: data.supplierId } } : undefined,
    };
  }

  private normalizeUpdateInput(data: UpdateProductDto): NormalizedUpdateInput {
    const normalized: NormalizedUpdateInput = { data: {} };

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException('Product name cannot be empty');
      }
      normalized.data.name = name;
    }

    if (data.barcode !== undefined) {
      normalized.barcode = this.normalizeOptionalString(data.barcode);
      normalized.data.barcode = normalized.barcode;
    }

    if (data.sku !== undefined) {
      normalized.sku = this.normalizeOptionalString(data.sku);
      normalized.data.sku = normalized.sku;
    }

    if (data.unit !== undefined) {
      normalized.data.unit = data.unit.trim() || 'unit';
    }

    if (data.currentStock !== undefined) {
      normalized.data.currentStock = this.normalizeInteger(data.currentStock, 'currentStock');
    }

    if (data.minStock !== undefined) {
      normalized.data.minStock = this.normalizeInteger(data.minStock, 'minStock');
    }

    if (data.costPrice !== undefined) {
      normalized.data.costPrice = this.normalizeDecimal(data.costPrice, 'costPrice');
    }

    if (data.sellingPrice !== undefined) {
      normalized.data.sellingPrice = this.normalizeDecimal(data.sellingPrice, 'sellingPrice');
    }

    if (data.expirationTracked !== undefined) {
      normalized.data.expirationTracked = data.expirationTracked;
    }

    if (data.expirationDate !== undefined) {
      normalized.data.expirationDate = this.normalizeDate(data.expirationDate);
    }

    if (data.isActive !== undefined) {
      normalized.data.isActive = data.isActive;
    }

    if (data.categoryId !== undefined) {
      normalized.categoryId = data.categoryId;
      normalized.data.category = data.categoryId
        ? { connect: { id: data.categoryId } }
        : { disconnect: true };
    }

    if (data.supplierId !== undefined) {
      normalized.supplierId = data.supplierId;
      normalized.data.supplier = data.supplierId
        ? { connect: { id: data.supplierId } }
        : { disconnect: true };
    }

    return normalized;
  }

  private normalizeOptionalString(value?: string | null) {
    if (value === undefined || value === null) {
      return value ?? null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private normalizeInteger(value: number | undefined, field: string, fallback?: number) {
    const parsed = value ?? fallback;
    if (parsed === undefined || parsed === null || !Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
    return parsed;
  }

  private normalizeDecimal(value: number | string, field: string) {
    const decimal = new Prisma.Decimal(value);
    if (decimal.isNegative()) {
      throw new BadRequestException(`${field} must be zero or greater`);
    }
    return decimal;
  }

  private normalizeDate(value?: string | null) {
    if (value === undefined || value === null || value === '') {
      return value === undefined ? undefined : null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('expirationDate must be a valid date');
    }

    return parsed;
  }

  private async assertRelationsExist(categoryId?: number | null, supplierId?: number | null) {
    if (categoryId !== undefined && categoryId !== null) {
      const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        throw new BadRequestException(`Category ${categoryId} not found`);
      }
    }

    if (supplierId !== undefined && supplierId !== null) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        throw new BadRequestException(`Supplier ${supplierId} not found`);
      }
    }
  }

  private async assertUniqueFields(barcode?: string | null, sku?: string | null, productId?: number) {
    if (barcode) {
      const existing = await this.prisma.product.findFirst({
        where: {
          barcode,
          ...(productId ? { id: { not: productId } } : {}),
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException(`Barcode ${barcode} already exists`);
      }
    }

    if (sku) {
      const existing = await this.prisma.product.findFirst({
        where: {
          sku,
          ...(productId ? { id: { not: productId } } : {}),
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException(`SKU ${sku} already exists`);
      }
    }
  }

  private async recordUpdateAudits(
    previous: ProductWithRelations,
    current: ProductWithRelations,
    operator: { id: number; email: string },
  ) {
    const audits: Promise<unknown>[] = [];
    const changeMap: Array<[string, string | null, string | null]> = [
      ['name', previous.name, current.name],
      ['barcode', previous.barcode, current.barcode],
      ['sku', previous.sku, current.sku],
      ['unit', previous.unit, current.unit],
      ['currentStock', String(previous.currentStock), String(current.currentStock)],
      ['minStock', String(previous.minStock), String(current.minStock)],
      ['costPrice', previous.costPrice.toString(), current.costPrice.toString()],
      ['sellingPrice', previous.sellingPrice.toString(), current.sellingPrice.toString()],
      ['expirationTracked', String(previous.expirationTracked), String(current.expirationTracked)],
      [
        'expirationDate',
        previous.expirationDate ? previous.expirationDate.toISOString() : null,
        current.expirationDate ? current.expirationDate.toISOString() : null,
      ],
      ['isActive', String(previous.isActive), String(current.isActive)],
      ['category', previous.category?.name ?? null, current.category?.name ?? null],
      ['supplier', previous.supplier?.name ?? null, current.supplier?.name ?? null],
    ];

    for (const [field, oldValue, newValue] of changeMap) {
      if (oldValue !== newValue) {
        audits.push(
          this.auditTrailService.create({
            table: 'products',
            recordId: current.id,
            field,
            oldValue,
            newValue,
            userId: operator.id,
            userEmail: operator.email,
          }),
        );
      }
    }

    await Promise.all(audits);
  }
}
