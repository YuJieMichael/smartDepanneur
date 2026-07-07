import { Controller, Post, Get, Patch, Delete, Query, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JobPostService } from './job-post.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostField } from '../common/types';

@Controller('api/job-posts')
export class JobPostController {
  constructor(private readonly service: JobPostService) {}

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async list(
    @Query('title') title?: string,
    @Query('filterStates') filterStates?: string,
    @Query('filterPostedDates') filterPostedDates?: string,
    @Query('filter') filter?: string,
    @Query('sortField') sortField?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Request() req?: { user: { id: number } },
  ) {
    return this.service.getJobPosts({
      title,
      filterStates,
      filterPostedDates,
      filter: (filter as 'all' | 'collected' | 'applied' | 'my') || 'all',
      userId: req?.user?.id,
      sortField,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: { title: string; jobDescription: string; questions: PostField[]; reviewer: string },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.service.create({
      ...body,
      postedBy: req.user.email,
      userId: req.user.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reviewers')
  async addReviewer(
    @Param('id') id: string,
    @Request() req: { user: { email: string } },
  ) {
    return this.service.addReviewer(parseInt(id, 10), req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/collector')
  async toggleCollector(
    @Param('id') id: string,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.toggleCollector(parseInt(id, 10), req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { state?: string },
  ) {
    return this.service.update(parseInt(id, 10), body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(parseInt(id, 10));
  }
}
