import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STORE_AUDIT_TABLES = new Set([
  'categories',
  'inventory_movements',
  'products',
  'purchase_orders',
  'sales',
  'suppliers',
]);

@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    table: string;
    recordId: number;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    userId: number;
    userEmail: string;
  }) {
    return this.prisma.auditTrail.create({ data });
  }

  async findByRecord(
    table: string,
    recordId: number,
    userId: number,
    page = 1,
    pageSize = 10,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: { select: { name: true } } },
    });

    if (!user) {
      throw new ForbiddenException('User no longer exists');
    }

    const isAdmin = user.roles.some((role) => role.name === 'Admin');

    if (!isAdmin && !STORE_AUDIT_TABLES.has(table)) {
      throw new ForbiddenException(
        'Store audit access is limited to operational records',
      );
    }

    const where = { table, recordId };
    const [total, list] = await this.prisma.$transaction([
      this.prisma.auditTrail.count({ where }),
      this.prisma.auditTrail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, list, page, pageSize };
  }
}
