import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/audit-trail')
export class AuditTrailController {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':table/:recordId')
  async getByRecord(
    @Param('table') table: string,
    @Param('recordId') recordId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.auditTrailService.findByRecord(
      table,
      parseInt(recordId, 10),
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
  }
}
