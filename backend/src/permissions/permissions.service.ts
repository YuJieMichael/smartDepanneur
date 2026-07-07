import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';

export interface GetPermissionsQuery {
  name?: string;
  filterCodes?: string;
  filterRoles?: string;
  filterCreatedDates?: string;
  filterUpdatedDates?: string;
  sortField?: 'id' | 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async getPermissions(query: GetPermissionsQuery) {
    const {
      name,
      filterCodes,
      filterRoles,
      filterCreatedDates,
      filterUpdatedDates,
      sortField = 'id',
      sortOrder = 'asc',
      page = 1,
      pageSize = 20,
    } = query;

    const and: Prisma.PermissionWhereInput[] = [];

    if (name) {
      and.push({ name: { contains: name, mode: 'insensitive' } });
    }
    if (filterCodes) {
      const codes = filterCodes.split(',').filter(Boolean);
      if (codes.length) and.push({ name: { in: codes } });
    }
    if (filterRoles) {
      const roles = filterRoles.split(',').filter(Boolean);
      if (roles.length) and.push({ roles: { some: { name: { in: roles } } } });
    }
    if (filterCreatedDates) {
      const dates = filterCreatedDates.split(',').filter(Boolean);
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
    if (filterUpdatedDates) {
      const dates = filterUpdatedDates.split(',').filter(Boolean);
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

    const where: Prisma.PermissionWhereInput = and.length ? { AND: and } : {};

    const [total, list] = await this.prisma.$transaction([
      this.prisma.permission.count({ where }),
      this.prisma.permission.findMany({
        where,
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          roles: { select: { id: true, name: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(field: string, query: GetPermissionsQuery): Promise<string[]> {
    const { name, filterCodes, filterRoles, filterCreatedDates, filterUpdatedDates } = query;
    const and: Prisma.PermissionWhereInput[] = [];

    if (name) {
      and.push({ name: { contains: name, mode: 'insensitive' } });
    }
    if (field !== 'name' && filterCodes) {
      const codes = filterCodes.split(',').filter(Boolean);
      if (codes.length) and.push({ name: { in: codes } });
    }
    if (field !== 'roles' && filterRoles) {
      const roles = filterRoles.split(',').filter(Boolean);
      if (roles.length) and.push({ roles: { some: { name: { in: roles } } } });
    }
    if (field !== 'createdAt' && filterCreatedDates) {
      const dates = filterCreatedDates.split(',').filter(Boolean);
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
    if (field !== 'updatedAt' && filterUpdatedDates) {
      const dates = filterUpdatedDates.split(',').filter(Boolean);
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

    const where: Prisma.PermissionWhereInput = and.length ? { AND: and } : {};

    switch (field) {
      case 'name': {
        const rows = await this.prisma.permission.findMany({
          where,
          select: { name: true },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) => r.name);
      }
      case 'roles': {
        const rows = await this.prisma.permission.findMany({
          where,
          select: { roles: { select: { name: true } } },
        });
        const names = new Set<string>();
        for (const row of rows) {
          for (const role of row.roles) {
            names.add(role.name);
          }
        }
        return [...names].sort();
      }
      case 'createdAt': {
        const rows = await this.prisma.permission.findMany({
          where,
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
        return [...new Set(rows.map((r) => r.createdAt.toISOString().split('T')[0]))];
      }
      case 'updatedAt': {
        const rows = await this.prisma.permission.findMany({
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

  async createPermission(
    data: { name: string; roleNames: string[] },
    operator: { id: number; email: string },
  ) {
    const result = await this.prisma.permission.create({
      data: {
        name: data.name,
        roles: {
          connect: data.roleNames.map((name) => ({ name })),
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { id: true, name: true } },
      },
    });

    await this.auditTrailService.create({
      table: 'permissions',
      recordId: result.id,
      field: '[created]',
      oldValue: null,
      newValue: `${result.name} (roles: ${data.roleNames.join(', ') || 'none'})`,
      userId: operator.id,
      userEmail: operator.email,
    });

    return result;
  }

  async findById(id: number) {
    return this.prisma.permission.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { id: true, name: true } },
      },
    });
  }

  async updatePermission(
    id: number,
    data: { roleNames?: string[] },
    operator: { id: number; email: string },
  ) {
    const old = await this.prisma.permission.findUnique({
      where: { id },
      select: {
        roles: { select: { name: true } },
      },
    });

    const result = await this.prisma.permission.update({
      where: { id },
      data: {
        ...(data.roleNames !== undefined
          ? { roles: { set: data.roleNames.map((name) => ({ name })) } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { id: true, name: true } },
      },
    });

    if (old && data.roleNames !== undefined) {
      const oldRoles = old.roles.map((r) => r.name).sort().join(', ');
      const newRoles = data.roleNames.sort().join(', ');
      if (oldRoles !== newRoles) {
        await this.auditTrailService.create({
          table: 'permissions',
          recordId: id,
          field: 'roles',
          oldValue: oldRoles || null,
          newValue: newRoles || null,
          userId: operator.id,
          userEmail: operator.email,
        });
      }
    }

    return result;
  }

  async deletePermission(
    id: number,
    operator: { id: number; email: string },
  ) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      select: { name: true },
    });

    await this.prisma.permission.delete({ where: { id } });

    if (permission) {
      await this.auditTrailService.create({
        table: 'permissions',
        recordId: id,
        field: '[deleted]',
        oldValue: permission.name,
        newValue: null,
        userId: operator.id,
        userEmail: operator.email,
      });
    }

    return { success: true };
  }
}
