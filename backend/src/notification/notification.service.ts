import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsReviewed(id: number) {
    return this.prisma.notification.update({
      where: { id },
      data: { reviewed: true },
    });
  }

  async markAllAsReviewed(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, reviewed: false },
      data: { reviewed: true },
    });
  }
}
