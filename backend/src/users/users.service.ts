import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';

export interface GetUsersQuery {
  email?: string;
  filterIds?: string;
  filterEmails?: string;
  filterRoles?: string;
  filterDates?: string;
  sortField?: 'id' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getUsers(query: GetUsersQuery) {
    const {
      email,
      filterIds,
      filterEmails,
      filterRoles,
      filterDates,
      sortField = 'id',
      sortOrder = 'asc',
      page = 1,
      pageSize = 20,
    } = query;

    const and: Prisma.UserWhereInput[] = [];

    if (email) {
      and.push({ email: { contains: email, mode: 'insensitive' } });
    }
    if (filterIds) {
      const ids = filterIds.split(',').map(Number).filter(Boolean);
      if (ids.length) and.push({ id: { in: ids } });
    }
    if (filterEmails) {
      const emails = filterEmails.split(',').filter(Boolean);
      if (emails.length) and.push({ email: { in: emails } });
    }
    if (filterRoles) {
      const roles = filterRoles.split(',').filter(Boolean);
      if (roles.length) and.push({ roles: { some: { name: { in: roles } } } });
    }
    if (filterDates) {
      const dates = filterDates.split(',').filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((d) => {
            const start = new Date(d + 'T00:00:00.000Z');
            const end = new Date(start.getTime() + 86400000);
            return {
              createdAt: { gte: start, lt: end },
            };
          }),
        });
      }
    }

    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

    const [total, list] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
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

  async getFilterOptions(field: string, query: GetUsersQuery): Promise<string[]> {
    // Build the same where clause but exclude the filter for the requested field
    const { email, filterIds, filterEmails, filterRoles, filterDates } = query;
    const and: Prisma.UserWhereInput[] = [];

    if (email) {
      and.push({ email: { contains: email, mode: 'insensitive' } });
    }
    if (field !== 'id' && filterIds) {
      const ids = filterIds.split(',').map(Number).filter(Boolean);
      if (ids.length) and.push({ id: { in: ids } });
    }
    if (field !== 'email' && filterEmails) {
      const emails = filterEmails.split(',').filter(Boolean);
      if (emails.length) and.push({ email: { in: emails } });
    }
    if (field !== 'roles' && filterRoles) {
      const roles = filterRoles.split(',').filter(Boolean);
      if (roles.length) and.push({ roles: { some: { name: { in: roles } } } });
    }
    if (field !== 'createdAt' && filterDates) {
      const dates = filterDates.split(',').filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((d) => {
            const start = new Date(d + 'T00:00:00.000Z');
            const end = new Date(start.getTime() + 86400000);
            return {
              createdAt: { gte: start, lt: end },
            };
          }),
        });
      }
    }

    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

    switch (field) {
      case 'id': {
        const rows = await this.prisma.user.findMany({
          where,
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        return rows.map((r) => String(r.id));
      }
      case 'email': {
        const rows = await this.prisma.user.findMany({
          where,
          select: { email: true },
          orderBy: { email: 'asc' },
        });
        return rows.map((r) => r.email);
      }
      case 'roles': {
        // Get role names that exist on users matching the current filters
        const rows = await this.prisma.user.findMany({
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
        const rows = await this.prisma.user.findMany({
          where,
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
        return [...new Set(rows.map((r) => r.createdAt.toISOString().split('T')[0]))];
      }
      default:
        return [];
    }
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { id: true, name: true } },
      },
    });
  }

  async updateUser(
    id: number,
    data: { email?: string; roleNames?: string[] },
    operator: { id: number; email: string },
  ) {
    const old = await this.prisma.user.findUnique({
      where: { id },
      select: {
        email: true,
        roles: { select: { name: true } },
      },
    });

    const result = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.roleNames !== undefined
          ? { roles: { set: data.roleNames.map((name) => ({ name })) } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { id: true, name: true } },
      },
    });

    // Record audit trails
    if (old) {
      const audits: Promise<any>[] = [];
      if (data.email !== undefined && data.email !== old.email) {
        audits.push(
          this.auditTrailService.create({
            table: 'users',
            recordId: id,
            field: 'email',
            oldValue: old.email,
            newValue: data.email,
            userId: operator.id,
            userEmail: operator.email,
          }),
        );
      }
      if (data.roleNames !== undefined) {
        const oldRoles = old.roles.map((r) => r.name).sort().join(', ');
        const newRoles = data.roleNames.sort().join(', ');
        if (oldRoles !== newRoles) {
          audits.push(
            this.auditTrailService.create({
              table: 'users',
              recordId: id,
              field: 'roles',
              oldValue: oldRoles || null,
              newValue: newRoles || null,
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

  async deleteUser(
    id: number,
    operator: { id: number; email: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true },
    });

    await this.prisma.user.delete({ where: { id } });

    if (user) {
      await this.auditTrailService.create({
        table: 'users',
        recordId: id,
        field: '[deleted]',
        oldValue: user.email,
        newValue: null,
        userId: operator.id,
        userEmail: operator.email,
      });
    }

    return { success: true };
  }
}
