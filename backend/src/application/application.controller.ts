import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationAnswer } from '../common/types';

@Controller('api/applications')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: { jobPostId: number; answers: ApplicationAnswer[] },
    @Request() req: { user: { id: number } },
  ) {
    return this.service.create({
      userId: req.user.id,
      jobPostId: body.jobPostId,
      answers: body.answers,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('check')
  async check(
    @Query('jobPostId') jobPostId: string,
    @Request() req: { user: { id: number } },
  ) {
    const app = await this.service.findByUserAndPost(req.user.id, parseInt(jobPostId, 10));
    return { applied: !!app, application: app };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async my(@Request() req: { user: { id: number } }) {
    return this.service.findByUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-post/:postId/filter-options')
  async filterOptions(
    @Param('postId') postId: string,
    @Query('field') field: string,
  ) {
    return this.service.getFilterOptions(parseInt(postId, 10), field);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-post/:postId')
  async byPost(
    @Param('postId') postId: string,
    @Query('search') search?: string,
    @Query('filterStates') filterStates?: string,
    @Query('filterDates') filterDates?: string,
    @Query('sortField') sortField?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findByJobPostId(parseInt(postId, 10), {
      search,
      filterStates,
      filterDates,
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
  @Patch('by-post/:postId/review-all')
  async reviewAll(@Param('postId') postId: string, @Request() req: { user: { id: number } }) {
    return this.service.reviewAllByPostId(parseInt(postId, 10), req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/state')
  async updateState(
    @Param('id') id: string,
    @Body() body: { state: string },
  ) {
    return this.service.updateState(parseInt(id, 10), body.state);
  }
}
