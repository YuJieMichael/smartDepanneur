import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ApplicationAnswer } from '../common/types';

@Injectable()
export class ApplicationService {
  constructor(private prisma: PrismaService) {}

  async create(data: { userId: number; jobPostId: number; answers: ApplicationAnswer[] }) {
    const existing = await this.prisma.application.findUnique({
      where: { userId_jobPostId: { userId: data.userId, jobPostId: data.jobPostId } },
    });
    if (existing) {
      throw new ConflictException('You have already applied to this post');
    }
    const application = await this.prisma.application.create({
      data: { ...data, answers: data.answers as unknown as Prisma.InputJsonValue },
    });

    const jobPost = await this.prisma.jobPost.findUnique({
      where: { id: data.jobPostId },
      select: { userId: true, title: true },
    });
    if (jobPost) {
      await this.prisma.notification.create({
        data: {
          message: `New application received for "${jobPost.title}"`,
          url: `/application/${application.id}`,
          userId: jobPost.userId,
        },
      });
    }

    return application;
  }

  async findByUserAndPost(userId: number, jobPostId: number) {
    return this.prisma.application.findUnique({
      where: { userId_jobPostId: { userId, jobPostId } },
    });
  }

  async findByUser(userId: number) {
    return this.prisma.application.findMany({
      where: { userId },
      select: { id: true, jobPostId: true, state: true },
    });
  }

  async findByJobPostId(jobPostId: number, query: {
    search?: string;
    filterStates?: string;
    filterDates?: string;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  } = {}) {
    const { page = 1, pageSize = 20 } = query;
    const and: Prisma.ApplicationWhereInput[] = [{ jobPostId }];

    if (query.search) {
      and.push({ user: { email: { contains: query.search, mode: 'insensitive' } } });
    }
    if (query.filterStates) {
      const states = query.filterStates.split(',').filter(Boolean);
      if (states.length) and.push({ state: { in: states as any } });
    }
    if (query.filterDates) {
      const dates = query.filterDates.split(',').filter(Boolean);
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

    const where: Prisma.ApplicationWhereInput = { AND: and };

    const allowedSortFields = ['id', 'state', 'createdAt'];
    const sortField = allowedSortFields.includes(query.sortField || '') ? query.sortField! : 'state';
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

    const [total, list] = await this.prisma.$transaction([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        include: { user: { select: { id: true, email: true } } },
        orderBy: sortField === 'state'
          ? [{ state: sortOrder }, { createdAt: 'desc' }]
          : { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async getFilterOptions(jobPostId: number, field: string) {
    if (field === 'state') {
      const rows = await this.prisma.application.findMany({
        where: { jobPostId },
        select: { state: true },
        distinct: ['state'],
      });
      return rows.map((r) => r.state);
    }
    if (field === 'createdAt') {
      const rows = await this.prisma.application.findMany({
        where: { jobPostId },
        select: { createdAt: true },
        distinct: ['createdAt'],
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => r.createdAt.toISOString().slice(0, 10));
    }
    return [];
  }

  async updateState(id: number, state: string) {
    const validStates = ['applied', 'reviewed', 'rejected'];
    if (!validStates.includes(state)) {
      throw new BadRequestException(`Invalid state: ${state}`);
    }
    const application = await this.prisma.application.update({
      where: { id },
      data: { state: state as any },
    });

    if (state === 'rejected') {
      await this.prisma.notification.create({
        data: {
          userId: application.userId,
          message: 'You have a new application status update',
          url: `/?tab=applied&appId=${id}`,
          reviewed: false,
        },
      });
    }

    return application;
  }

  async reviewAllByPostId(postId: number, userId: number) {
    const post = await this.prisma.jobPost.findUnique({ where: { id: postId }, select: { userId: true } });
    if (!post || post.userId !== userId) {
      throw new BadRequestException('Not authorized to review applications for this post');
    }
    return this.prisma.application.updateMany({
      where: { jobPostId: postId, state: 'applied' },
      data: { state: 'reviewed' },
    });
  }

  async findById(id: number) {
    return this.prisma.application.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        jobPost: { select: { id: true, title: true } },
      },
    });
  }
}
