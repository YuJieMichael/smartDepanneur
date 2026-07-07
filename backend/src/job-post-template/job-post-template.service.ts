import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PostField } from '../common/types';

@Injectable()
export class JobPostTemplateService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: number) {
    return this.prisma.jobPostTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    return this.prisma.jobPostTemplate.findUnique({ where: { id } });
  }

  async create(data: {
    templateName: string;
    fields: PostField[];
    userId: number;
  }) {
    return this.prisma.jobPostTemplate.create({
      data: { ...data, fields: data.fields as unknown as Prisma.InputJsonValue },
    });
  }

  async update(id: number, data: { templateName: string; fields: PostField[] }) {
    return this.prisma.jobPostTemplate.update({
      where: { id },
      data: { ...data, fields: data.fields as unknown as Prisma.InputJsonValue },
    });
  }
}
