import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import type { InventoryMovementSortField } from './dto/query-inventory-movements.dto';
import { StockInDto } from './dto/stock-in.dto';
import { WasteStockDto } from './dto/waste-stock.dto';
import { InventoryService } from './inventory.service';

@Controller('api/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('productName') productName?: string,
    @Query('filterTypes') filterTypes?: string,
    @Query('filterProductNames') filterProductNames?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
  ) {
    return this.inventoryService.getFilterOptions(field, {
      productName,
      filterTypes,
      filterProductNames,
      filterCreatedDates,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('movements')
  async getInventoryMovements(
    @Query('productName') productName?: string,
    @Query('filterTypes') filterTypes?: string,
    @Query('filterProductNames') filterProductNames?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('sortField') sortField?: InventoryMovementSortField,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.getInventoryMovements({
      productName,
      filterTypes,
      filterProductNames,
      filterCreatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('stock-in')
  async stockIn(
    @Body() body: StockInDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.inventoryService.stockIn(body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('adjust')
  async adjustStock(
    @Body() body: AdjustStockDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.inventoryService.adjustStock(body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('waste')
  async wasteStock(
    @Body() body: WasteStockDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.inventoryService.wasteStock(body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('low-stock')
  async getLowStockProducts() {
    return this.inventoryService.getLowStockProducts();
  }

  @UseGuards(JwtAuthGuard)
  @Get('expiration-alerts')
  async getExpirationAlerts(@Query('days') days?: string) {
    return this.inventoryService.getExpirationAlerts(days ? parseInt(days, 10) : undefined);
  }
}
