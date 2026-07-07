import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';

export interface GetDictionariesQuery {
  key?: string;
  filterKeys?: string;
  filterCategories?: string;
  filterCreatedDates?: string;
  filterUpdatedDates?: string;
  sortField?: 'id' | 'key' | 'category' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class DictionaryPageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  private buildWhere(query: GetDictionariesQuery, excludeField?: string) {
    const and: Prisma.DictionaryWhereInput[] = [];

    if (query.key) {
      and.push({ key: { contains: query.key, mode: 'insensitive' } });
    }
    if (excludeField !== 'key' && query.filterKeys) {
      const keys = query.filterKeys.split(',').filter(Boolean);
      if (keys.length) and.push({ key: { in: keys } });
    }
    if (excludeField !== 'category' && query.filterCategories) {
      const cats = query.filterCategories.split(',').filter(Boolean);
      if (cats.length) and.push({ category: { in: cats } });
    }
    if (excludeField !== 'createdAt' && query.filterCreatedDates) {
      const dates = query.filterCreatedDates.split(',').filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((d) => {
            const start = new Date(d + 'T00:00:00.000Z');
            const end = new Date(start.getTime() + 86400000);
            return { createdAt: { gte: start, lt: end } };
          }),
        });
      }
    }
    if (excludeField !== 'updatedAt' && query.filterUpdatedDates) {
      const dates = query.filterUpdatedDates.split(',').filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((d) => {
            const start = new Date(d + 'T00:00:00.000Z');
            const end = new Date(start.getTime() + 86400000);
            return { updatedAt: { gte: start, lt: end } };
          }),
        });
      }
    }

    return and.length ? { AND: and } : {};
  }

  async getDictionaries(query: GetDictionariesQuery) {
    const {
      sortField = 'id',
      sortOrder = 'asc',
      page = 1,
      pageSize = 20,
    } = query;

    const where = this.buildWhere(query);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.dictionary.count({ where }),
      this.prisma.dictionary.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(field: string, query: GetDictionariesQuery): Promise<string[]> {
    const where = this.buildWhere(query, field);

    switch (field) {
      case 'key': {
        const rows = await this.prisma.dictionary.findMany({
          where,
          select: { key: true },
          orderBy: { key: 'asc' },
        });
        return rows.map((r) => r.key);
      }
      case 'category': {
        const rows = await this.prisma.dictionary.findMany({
          where,
          select: { category: true },
          orderBy: { category: 'asc' },
        });
        return [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[];
      }
      case 'createdAt': {
        const rows = await this.prisma.dictionary.findMany({
          where,
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
        return [...new Set(rows.map((r) => r.createdAt.toISOString().split('T')[0]))];
      }
      case 'updatedAt': {
        const rows = await this.prisma.dictionary.findMany({
          where,
          select: { updatedAt: true },
          orderBy: { updatedAt: 'asc' },
        });
        return [...new Set(rows.map((r) => r.updatedAt.toISOString().split('T')[0]))];
      }
      default:
        return [];
    }
  }

  async createDictionary(
    data: { key: string; value: string[]; category?: string },
    operator: { id: number; email: string },
  ) {
    const result = await this.prisma.dictionary.create({ data });

    await this.auditTrailService.create({
      table: 'dictionaries',
      recordId: result.id,
      field: '[created]',
      oldValue: null,
      newValue: `${result.key} (${result.value.length} values)`,
      userId: operator.id,
      userEmail: operator.email,
    });

    return result;
  }

  async findById(id: number) {
    return this.prisma.dictionary.findUnique({ where: { id } });
  }

  async updateDictionary(
    id: number,
    data: { key?: string; value?: string[]; category?: string },
    operator: { id: number; email: string },
  ) {
    const old = await this.prisma.dictionary.findUnique({ where: { id } });

    const result = await this.prisma.dictionary.update({
      where: { id },
      data,
    });

    if (old) {
      const audits: Promise<any>[] = [];
      if (data.key !== undefined && data.key !== old.key) {
        audits.push(
          this.auditTrailService.create({
            table: 'dictionaries',
            recordId: id,
            field: 'key',
            oldValue: old.key,
            newValue: data.key,
            userId: operator.id,
            userEmail: operator.email,
          }),
        );
      }
      if (data.value !== undefined) {
        const oldVal = old.value.join(', ');
        const newVal = data.value.join(', ');
        if (oldVal !== newVal) {
          audits.push(
            this.auditTrailService.create({
              table: 'dictionaries',
              recordId: id,
              field: 'value',
              oldValue: oldVal || null,
              newValue: newVal || null,
              userId: operator.id,
              userEmail: operator.email,
            }),
          );
        }
      }
      if (data.category !== undefined && data.category !== old.category) {
        audits.push(
          this.auditTrailService.create({
            table: 'dictionaries',
            recordId: id,
            field: 'category',
            oldValue: old.category || null,
            newValue: data.category || null,
            userId: operator.id,
            userEmail: operator.email,
          }),
        );
      }
      await Promise.all(audits);
    }

    return result;
  }

  async deleteDictionary(
    id: number,
    operator: { id: number; email: string },
  ) {
    const dict = await this.prisma.dictionary.findUnique({
      where: { id },
      select: { key: true },
    });

    await this.prisma.dictionary.delete({ where: { id } });

    if (dict) {
      await this.auditTrailService.create({
        table: 'dictionaries',
        recordId: id,
        field: '[deleted]',
        oldValue: dict.key,
        newValue: null,
        userId: operator.id,
        userEmail: operator.email,
      });
    }

    return { success: true };
  }
}
