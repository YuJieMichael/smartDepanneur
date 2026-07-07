import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostField } from '../common/types';

export interface GetJobPostsQuery {
  title?: string;
  filterStates?: string;
  filterPostedDates?: string;
  filter?: 'all' | 'collected' | 'applied' | 'my';
  userId?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class JobPostService {
  constructor(private prisma: PrismaService) {}

  private async buildWhere(query: GetJobPostsQuery) {
    const and: Prisma.JobPostWhereInput[] = [];

    if (query.title) {
      and.push({ title: { contains: query.title, mode: 'insensitive' } });
    }
    if (query.filterStates) {
      const states = query.filterStates.split(',').filter(Boolean);
      if (states.length) and.push({ state: { in: states as any } });
    }
    if (query.filterPostedDates) {
      const dates = query.filterPostedDates.split(',').filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((d) => {
            const start = new Date(d + 'T00:00:00.000Z');
            const end = new Date(start.getTime() + 86400000);
            return { postedAt: { gte: start, lt: end } };
          }),
        });
      }
    }
    if (query.filter === 'my' && query.userId) {
      and.push({ userId: query.userId });
    }
    if (query.filter === 'collected' && query.userId) {
      and.push({ collector: { has: query.userId } });
    }
    if (query.filter === 'applied' && query.userId) {
      const apps = await this.prisma.application.findMany({
        where: { userId: query.userId },
        select: { jobPostId: true },
      });
      and.push({ id: { in: apps.map((a) => a.jobPostId) } });
    }

    return and.length ? { AND: and } : {};
  }

  async getJobPosts(query: GetJobPostsQuery) {
    const { page = 1, pageSize = 20 } = query;
    const where = await this.buildWhere(query);

    const allowedSortFields = ['id', 'title', 'state', 'postedAt', 'createdAt'];
    const useAppliedSort = !query.sortField || query.sortField === 'appliedCount';

    if (useAppliedSort) {
      const total = await this.prisma.jobPost.count({ where });
      const all = await this.prisma.jobPost.findMany({
        where,
        include: {
          _count: {
            select: { applications: { where: { state: 'applied' } } },
          },
          applications: {
            where: { state: 'applied' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      all.sort((a, b) => {
        const countDiff = b._count.applications - a._count.applications;
        if (countDiff !== 0) return countDiff;
        const aTime = a.applications[0]?.createdAt?.getTime() ?? 0;
        const bTime = b.applications[0]?.createdAt?.getTime() ?? 0;
        if (aTime !== bTime) return bTime - aTime;
        // No unreviewed applications: active first, then by postedAt desc
        const aActive = a.state === 'active' ? 0 : 1;
        const bActive = b.state === 'active' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      });

      const paged = all.slice((page - 1) * pageSize, page * pageSize);
      const mapped = paged.map((p) => ({
        ...p,
        appliedCount: p._count.applications,
        _count: undefined,
        applications: undefined,
      }));

      return { total, list: mapped, page, pageSize };
    }

    const sortField = allowedSortFields.includes(query.sortField!) ? query.sortField! : 'postedAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, list] = await this.prisma.$transaction([
      this.prisma.jobPost.count({ where }),
      this.prisma.jobPost.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { applications: { where: { state: 'applied' } } },
          },
        },
      }),
    ]);

    const mapped = list.map((p) => ({
      ...p,
      appliedCount: p._count.applications,
      _count: undefined,
    }));

    return { total, list: mapped, page, pageSize };
  }

  async create(data: {
    title: string;
    jobDescription: string;
    questions: PostField[];
    postedBy: string;
    reviewer: string;
    userId: number;
  }) {
    const { reviewer, questions, ...rest } = data;
    return this.prisma.jobPost.create({
      data: {
        ...rest,
        questions: questions as unknown as Prisma.InputJsonValue,
        reviewer: reviewer ? [reviewer] : [],
      },
    });
  }

  async addReviewer(id: number, email: string) {
    const post = await this.prisma.jobPost.findUnique({ where: { id } });
    if (!post) return null;
    if (post.reviewer.includes(email)) return post;
    return this.prisma.jobPost.update({
      where: { id },
      data: { reviewer: { push: email } },
    });
  }

  async toggleCollector(id: number, userId: number) {
    const post = await this.prisma.jobPost.findUnique({ where: { id } });
    if (!post) return null;
    const collected = post.collector.includes(userId);
    return this.prisma.jobPost.update({
      where: { id },
      data: {
        collector: collected
          ? post.collector.filter((uid) => uid !== userId)
          : [...post.collector, userId],
      },
    });
  }

  async findById(id: number) {
    return this.prisma.jobPost.findUnique({ where: { id } });
  }

  async update(id: number, data: { state?: string }) {
    if (data.state) {
      const validStates = ['active', 'closed'];
      if (!validStates.includes(data.state)) {
        throw new Error(`Invalid state: ${data.state}`);
      }
    }
    return this.prisma.jobPost.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(id: number) {
    await this.prisma.application.deleteMany({ where: { jobPostId: id } });
    return this.prisma.jobPost.delete({ where: { id } });
  }

  async findCollectedByUserId(userId: number) {
    return this.prisma.jobPost.findMany({
      where: { collector: { has: userId } },
      orderBy: { postedAt: 'desc' },
    });
  }

  async findAppliedByUserId(userId: number) {
    const applications = await this.prisma.application.findMany({
      where: { userId },
      select: { jobPostId: true },
    });
    const postIds = applications.map((a) => a.jobPostId);
    if (!postIds.length) return [];
    return this.prisma.jobPost.findMany({
      where: { id: { in: postIds } },
      orderBy: { postedAt: 'desc' },
    });
  }

  async findByUserId(userId: number) {
    return this.prisma.jobPost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
