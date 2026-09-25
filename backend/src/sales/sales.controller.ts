import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import type { SaleSortField } from './dto/query-sales.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { SalesService } from './sales.service';

@Controller('api/sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('sales-edit')
  @Get('recent')
  async getRecentSales(
    @Query('limit') limit: string | undefined,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.salesService.getRecentSales(
      req.user,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('dashboard-view')
  @Get('list')
  async getSales(
    @Query('filterPaymentMethods') filterPaymentMethods?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('sortField') sortField?: SaleSortField,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.salesService.getSales({
      filterPaymentMethods,
      filterCreatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('dashboard-view')
  @Get('summary/daily')
  async getDailySummary(@Query('date') date?: string) {
    return this.salesService.getDailySummary(date);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('dashboard-view')
  @Get(':id')
  async getSaleById(@Param('id') id: string) {
    return this.salesService.findById(parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('sales-edit')
  @Post()
  async createSale(
    @Body() body: CreateSaleDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.salesService.createSale(body, req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('sales-edit')
  @Post(':id/void')
  async voidSale(
    @Param('id') id: string,
    @Body() body: VoidSaleDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.salesService.voidSale(parseInt(id, 10), body, req.user);
  }
}
