import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async findByRecord(table: string, recordId: number, page = 1, pageSize = 10) {
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
