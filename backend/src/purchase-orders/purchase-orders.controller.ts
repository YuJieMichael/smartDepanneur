import { Controller, Post, Query, Request, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { InsightLanguage } from '../insights/insights.service';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('api/purchase-orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('inventory-edit')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post('generate-from-reorder')
  async generateFromReorder(
    @Query('language') language: InsightLanguage | undefined,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.purchaseOrdersService.generateFromReorderSuggestions(
      language ?? 'en',
      req.user,
    );
  }
}
