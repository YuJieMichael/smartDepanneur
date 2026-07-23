import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getAllCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async getCategories(query: QueryCategoriesDto) {
    const {
      sortField = 'id',
      sortOrder = 'asc',
      page = 1,
      pageSize = 20,
    } = query;

    const where = this.buildWhere(query);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(field: string, query: QueryCategoriesDto): Promise<string[]> {
    const where = this.buildWhere(query, field);

    switch (field) {
      case 'name': {
        const rows = await this.prisma.category.findMany({
          where,
          select: { name: true },
          orderBy: { name: 'asc' },
        });
        return rows.map((row) => row.name);
      }
      case 'code': {
        const rows = await this.prisma.category.findMany({
          where,
          select: { code: true },
          orderBy: { code: 'asc' },
        });
        return rows.map((row) => row.code).filter(Boolean) as string[];
      }
      case 'createdAt': {
        const rows = await this.prisma.category.findMany({
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
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async createCategory(data: CreateCategoryDto, operator: { id: number; email: string }) {
    const normalized = this.normalizeCreateInput(data);
    await this.assertUniqueFields(normalized.name, normalized.code);

    const category = await this.prisma.category.create({ data: normalized });

    await this.auditTrailService.create({
      table: 'categories',
      recordId: category.id,
      field: '[created]',
      oldValue: null,
      newValue: category.name,
      userId: operator.id,
      userEmail: operator.email,
    });

    return category;
  }

  async updateCategory(id: number, data: UpdateCategoryDto, operator: { id: number; email: string }) {
    const existing = await this.findById(id);
    const normalized = this.normalizeUpdateInput(data);

    await this.assertUniqueFields(normalized.name, normalized.code, id);

    const category = await this.prisma.category.update({
      where: { id },
      data: normalized.data,
    });

    await this.recordAudits(existing, category, operator);

    return category;
  }

  async deleteCategory(id: number, operator: { id: number; email: string }) {
    const existing = await this.findById(id);
    await this.prisma.category.delete({ where: { id } });

    await this.auditTrailService.create({
      table: 'categories',
      recordId: id,
      field: '[deleted]',
      oldValue: existing.name,
      newValue: null,
      userId: operator.id,
      userEmail: operator.email,
    });

    return { success: true };
  }

  private buildWhere(query: QueryCategoriesDto, excludedField?: string): Prisma.CategoryWhereInput {
    const and: Prisma.CategoryWhereInput[] = [];

    if (query.name) {
      and.push({ name: { contains: query.name, mode: 'insensitive' } });
    }

    if (excludedField !== 'name' && query.filterNames) {
      const names = query.filterNames.split(',').map((value) => value.trim()).filter(Boolean);
      if (names.length) {
        and.push({ name: { in: names } });
      }
    }

    if (excludedField !== 'code' && query.filterCodes) {
      const codes = query.filterCodes.split(',').map((value) => value.trim()).filter(Boolean);
      if (codes.length) {
        and.push({ code: { in: codes } });
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

  private normalizeCreateInput(data: CreateCategoryDto): Prisma.CategoryCreateInput {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    return {
      name,
      code: data.code?.trim() || null,
    };
  }

  private normalizeUpdateInput(data: UpdateCategoryDto): { data: Prisma.CategoryUpdateInput; name?: string; code?: string | null } {
    const normalized: { data: Prisma.CategoryUpdateInput; name?: string; code?: string | null } = { data: {} };

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException('Category name is required');
      }
      normalized.name = name;
      normalized.data.name = name;
    }

    if (data.code !== undefined) {
      normalized.code = data.code?.trim() || null;
      normalized.data.code = normalized.code;
    }

    return normalized;
  }

  private async assertUniqueFields(name?: string, code?: string | null, categoryId?: number) {
    if (name) {
      const existing = await this.prisma.category.findFirst({
        where: { name, ...(categoryId ? { id: { not: categoryId } } : {}) },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(`Category ${name} already exists`);
      }
    }

    if (code) {
      const existing = await this.prisma.category.findFirst({
        where: { code, ...(categoryId ? { id: { not: categoryId } } : {}) },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(`Category code ${code} already exists`);
      }
    }
  }

  private async recordAudits(
    previous: { id: number; name: string; code: string | null },
    current: { id: number; name: string; code: string | null },
    operator: { id: number; email: string },
  ) {
    const audits: Promise<unknown>[] = [];
    if (previous.name !== current.name) {
      audits.push(this.auditTrailService.create({
        table: 'categories',
        recordId: current.id,
        field: 'name',
        oldValue: previous.name,
        newValue: current.name,
        userId: operator.id,
        userEmail: operator.email,
      }));
    }
    if (previous.code !== current.code) {
      audits.push(this.auditTrailService.create({
        table: 'categories',
        recordId: current.id,
        field: 'code',
        oldValue: previous.code,
        newValue: current.code,
        userId: operator.id,
        userEmail: operator.email,
      }));
    }
    await Promise.all(audits);
  }
}
