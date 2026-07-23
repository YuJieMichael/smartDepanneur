import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('dashboard-view')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('daily-closeout')
  async getDailyCloseout(@Query('date') date?: string) {
    return this.dashboardService.getDailyCloseout(date);
  }

  @Get('sales-trend')
  async getSalesTrend(@Query('days') days?: string) {
    return this.dashboardService.getSalesTrend(days ? Number(days) : 7);
  }
}
