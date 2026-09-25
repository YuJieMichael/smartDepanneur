import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/audit-trail')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('audit-view-store')
export class AuditTrailController {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  @Get(':table/:recordId')
  async getByRecord(
    @Param('table') table: string,
    @Param('recordId') recordId: string,
    @Request() req: { user: { id: number; email: string } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.auditTrailService.findByRecord(
      table,
      parseInt(recordId, 10),
      req.user.id,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
  }
}
