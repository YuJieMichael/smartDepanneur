import { Controller, Get, Post, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApplicantInfoService } from './applicant-info.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/applicant-info')
export class ApplicantInfoController {
  constructor(private readonly service: ApplicantInfoService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMine(@Request() req: { user: { id: number } }) {
    return this.service.findByUserId(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: {
      email: string;
      phone: string;
      nickname: string;
      country: string;
      state: string;
      address: string;
      postcode: string;
      resume: string;
    },
    @Request() req: { user: { id: number } },
  ) {
    return this.service.create({ ...body, userId: req.user.id });
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  async update(
    @Body() body: {
      email: string;
      phone: string;
      nickname: string;
      country: string;
      state: string;
      address: string;
      postcode: string;
      resume: string;
    },
    @Request() req: { user: { id: number } },
  ) {
    return this.service.update(req.user.id, body);
  }
}
