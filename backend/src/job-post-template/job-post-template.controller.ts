import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JobPostTemplateService } from './job-post-template.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostField } from '../common/types';

@Controller('api/job-post-templates')
export class JobPostTemplateController {
  constructor(private readonly service: JobPostTemplateService) {}

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.service.findByUserId(Number(userId));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: { templateName: string; fields: PostField[] },
    @Request() req: { user: { id: number } },
  ) {
    return this.service.create({ ...body, userId: req.user.id });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { templateName: string; fields: PostField[] },
  ) {
    return this.service.update(Number(id), body);
  }
}
