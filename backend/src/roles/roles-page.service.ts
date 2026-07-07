import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';

export interface GetRolesQuery {
  name?: string;
  filterNames?: string;
  filterPermissions?: string;
  filterCreatedDates?: string;
  filterUpdatedDates?: string;
  sortField?: 'id' | 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class RolesPageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getRoles(query: GetRolesQuery) {
    const {
      name,
      filterNames,
      filterPermissions,
      filterCreatedDates,
      filterUpdatedDates,
      sortField = 'id',
      sortOrder = 'asc',
      page = 1,
      pageSize = 20,
    } = query;

    const and: Prisma.RoleWhereInput[] = [];

    if (name) {
      and.push({ name: { contains: name, mode: 'insensitive' } });
    }
    if (filterNames) {
      const names = filterNames.split(',').filter(Boolean);
      if (names.length) and.push({ name: { in: names } });
    }
    if (filterPermissions) {
      const perms = filterPermissions.split(',').filter(Boolean);
      if (perms.length) and.push({ permissions: { some: { name: { in: perms } } } });
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

    const where: Prisma.RoleWhereInput = and.length ? { AND: and } : {};

    const [total, list] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          permissions: { select: { id: true, name: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(field: string, query: GetRolesQuery): Promise<string[]> {
    const { name, filterNames, filterPermissions, filterCreatedDates, filterUpdatedDates } = query;
    const and: Prisma.RoleWhereInput[] = [];

    if (name) {
      and.push({ name: { contains: name, mode: 'insensitive' } });
    }
    if (field !== 'name' && filterNames) {
      const names = filterNames.split(',').filter(Boolean);
      if (names.length) and.push({ name: { in: names } });
    }
    if (field !== 'permissions' && filterPermissions) {
      const perms = filterPermissions.split(',').filter(Boolean);
      if (perms.length) and.push({ permissions: { some: { name: { in: perms } } } });
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

    const where: Prisma.RoleWhereInput = and.length ? { AND: and } : {};

    switch (field) {
      case 'name': {
        const rows = await this.prisma.role.findMany({
          where,
          select: { name: true },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) => r.name);
      }
      case 'permissions': {
        const rows = await this.prisma.role.findMany({
          where,
          select: { permissions: { select: { name: true } } },
        });
        const names = new Set<string>();
        for (const row of rows) {
          for (const perm of row.permissions) {
            names.add(perm.name);
          }
        }
        return [...names].sort();
      }
      case 'createdAt': {
        const rows = await this.prisma.role.findMany({
          where,
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
        return [...new Set(rows.map((r) => r.createdAt.toISOString().split('T')[0]))];
      }
      case 'updatedAt': {
        const rows = await this.prisma.role.findMany({
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

  async createRole(
    data: { name: string; permissionNames: string[] },
    operator: { id: number; email: string },
  ) {
    const result = await this.prisma.role.create({
      data: {
        name: data.name,
        permissions: {
          connect: data.permissionNames.map((name) => ({ name })),
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { id: true, name: true } },
      },
    });

    await this.auditTrailService.create({
      table: 'roles',
      recordId: result.id,
      field: '[created]',
      oldValue: null,
      newValue: `${result.name} (permissions: ${data.permissionNames.join(', ') || 'none'})`,
      userId: operator.id,
      userEmail: operator.email,
    });

    return result;
  }

  async findById(id: number) {
    return this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { id: true, name: true } },
      },
    });
  }

  async updateRole(
    id: number,
    data: { name?: string; permissionNames?: string[] },
    operator: { id: number; email: string },
  ) {
    const old = await this.prisma.role.findUnique({
      where: { id },
      select: {
        name: true,
        permissions: { select: { name: true } },
      },
    });

    const result = await this.prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.permissionNames !== undefined
          ? { permissions: { set: data.permissionNames.map((name) => ({ name })) } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { id: true, name: true } },
      },
    });

    if (old) {
      const audits: Promise<any>[] = [];
      if (data.name !== undefined && data.name !== old.name) {
        audits.push(
          this.auditTrailService.create({
            table: 'roles',
            recordId: id,
            field: 'name',
            oldValue: old.name,
            newValue: data.name,
            userId: operator.id,
            userEmail: operator.email,
          }),
        );
      }
      if (data.permissionNames !== undefined) {
        const oldPerms = old.permissions.map((p) => p.name).sort().join(', ');
        const newPerms = data.permissionNames.sort().join(', ');
        if (oldPerms !== newPerms) {
          audits.push(
            this.auditTrailService.create({
              table: 'roles',
              recordId: id,
              field: 'permissions',
              oldValue: oldPerms || null,
              newValue: newPerms || null,
              userId: operator.id,
              userEmail: operator.email,
            }),
          );
        }
      }
      await Promise.all(audits);
    }

    return result;
  }

  async deleteRole(
    id: number,
    operator: { id: number; email: string },
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { name: true },
    });

    await this.prisma.role.delete({ where: { id } });

    if (role) {
      await this.auditTrailService.create({
        table: 'roles',
        recordId: id,
        field: '[deleted]',
        oldValue: role.name,
        newValue: null,
        userId: operator.id,
        userEmail: operator.email,
      });
    }

    return { success: true };
  }
}
