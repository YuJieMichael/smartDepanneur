import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getAllSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  async getSuppliers(query: QuerySuppliersDto) {
    const {
      sortField = 'id',
      sortOrder = 'asc',
      page = 1,
      pageSize = 20,
    } = query;

    const where = this.buildWhere(query);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(field: string, query: QuerySuppliersDto): Promise<string[]> {
    const where = this.buildWhere(query, field);

    switch (field) {
      case 'name': {
        const rows = await this.prisma.supplier.findMany({
          where,
          select: { name: true },
          orderBy: { name: 'asc' },
        });
        return rows.map((row) => row.name);
      }
      case 'contactName': {
        const rows = await this.prisma.supplier.findMany({
          where,
          select: { contactName: true },
          orderBy: { contactName: 'asc' },
        });
        return rows.map((row) => row.contactName).filter(Boolean) as string[];
      }
      case 'email': {
        const rows = await this.prisma.supplier.findMany({
          where,
          select: { email: true },
          orderBy: { email: 'asc' },
        });
        return rows.map((row) => row.email).filter(Boolean) as string[];
      }
      case 'createdAt': {
        const rows = await this.prisma.supplier.findMany({
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
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return supplier;
  }

  async createSupplier(data: CreateSupplierDto, operator: { id: number; email: string }) {
    const normalized = this.normalizeCreateInput(data);
    await this.assertUniqueName(normalized.name);

    const supplier = await this.prisma.supplier.create({ data: normalized });

    await this.auditTrailService.create({
      table: 'suppliers',
      recordId: supplier.id,
      field: '[created]',
      oldValue: null,
      newValue: supplier.name,
      userId: operator.id,
      userEmail: operator.email,
    });

    return supplier;
  }

  async updateSupplier(id: number, data: UpdateSupplierDto, operator: { id: number; email: string }) {
    const existing = await this.findById(id);
    const normalized = this.normalizeUpdateInput(data);

    if (normalized.name) {
      await this.assertUniqueName(normalized.name, id);
    }

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: normalized.data,
    });

    await this.recordAudits(existing, supplier, operator);

    return supplier;
  }

  async deleteSupplier(id: number, operator: { id: number; email: string }) {
    const existing = await this.findById(id);
    await this.prisma.supplier.delete({ where: { id } });

    await this.auditTrailService.create({
      table: 'suppliers',
      recordId: id,
      field: '[deleted]',
      oldValue: existing.name,
      newValue: null,
      userId: operator.id,
      userEmail: operator.email,
    });

    return { success: true };
  }

  private buildWhere(query: QuerySuppliersDto, excludedField?: string): Prisma.SupplierWhereInput {
    const and: Prisma.SupplierWhereInput[] = [];

    if (query.name) {
      and.push({ name: { contains: query.name, mode: 'insensitive' } });
    }

    if (excludedField !== 'name' && query.filterNames) {
      const names = query.filterNames.split(',').map((value) => value.trim()).filter(Boolean);
      if (names.length) {
        and.push({ name: { in: names } });
      }
    }

    if (excludedField !== 'contactName' && query.filterContactNames) {
      const contactNames = query.filterContactNames.split(',').map((value) => value.trim()).filter(Boolean);
      if (contactNames.length) {
        and.push({ contactName: { in: contactNames } });
      }
    }

    if (excludedField !== 'email' && query.filterEmails) {
      const emails = query.filterEmails.split(',').map((value) => value.trim()).filter(Boolean);
      if (emails.length) {
        and.push({ email: { in: emails } });
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

  private normalizeCreateInput(data: CreateSupplierDto): Prisma.SupplierCreateInput {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('Supplier name is required');
    }

    return {
      name,
      contactName: data.contactName?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      notes: data.notes?.trim() || null,
    };
  }

  private normalizeUpdateInput(data: UpdateSupplierDto): {
    data: Prisma.SupplierUpdateInput;
    name?: string;
  } {
    const normalized: {
      data: Prisma.SupplierUpdateInput;
      name?: string;
    } = { data: {} };

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException('Supplier name is required');
      }
      normalized.name = name;
      normalized.data.name = name;
    }

    if (data.contactName !== undefined) {
      normalized.data.contactName = data.contactName?.trim() || null;
    }

    if (data.phone !== undefined) {
      normalized.data.phone = data.phone?.trim() || null;
    }

    if (data.email !== undefined) {
      normalized.data.email = data.email?.trim() || null;
    }

    if (data.notes !== undefined) {
      normalized.data.notes = data.notes?.trim() || null;
    }

    return normalized;
  }

  private async assertUniqueName(name: string, supplierId?: number) {
    const existing = await this.prisma.supplier.findFirst({
      where: { name, ...(supplierId ? { id: { not: supplierId } } : {}) },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Supplier ${name} already exists`);
    }
  }

  private async recordAudits(
    previous: { id: number; name: string; contactName: string | null; phone: string | null; email: string | null; notes: string | null },
    current: { id: number; name: string; contactName: string | null; phone: string | null; email: string | null; notes: string | null },
    operator: { id: number; email: string },
  ) {
    const fields: Array<[string, string | null, string | null]> = [
      ['name', previous.name, current.name],
      ['contactName', previous.contactName, current.contactName],
      ['phone', previous.phone, current.phone],
      ['email', previous.email, current.email],
      ['notes', previous.notes, current.notes],
    ];

    await Promise.all(
      fields
        .filter(([, oldValue, newValue]) => oldValue !== newValue)
        .map(([field, oldValue, newValue]) =>
          this.auditTrailService.create({
            table: 'suppliers',
            recordId: current.id,
            field,
            oldValue,
            newValue,
            userId: operator.id,
            userEmail: operator.email,
          }),
        ),
    );
  }
}