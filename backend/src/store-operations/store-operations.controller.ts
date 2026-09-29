import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { StoreOperationsService } from './store-operations.service';
import type { ReceiptInput, CloseInput } from './store-operations.service';
import { ProductImportService } from './product-import.service';
import type { Operator } from './common';

@Controller('api/store-operations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StoreOperationsController {
  constructor(
    private readonly operations: StoreOperationsService,
    private readonly imports: ProductImportService,
  ) {}

  @Get('purchase-orders')
  @RequirePermissions('inventory-edit')
  orders() {
    return this.operations.orders();
  }
  @Patch('purchase-orders/:id/status')
  @RequirePermissions('inventory-edit')
  status(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'sent' | 'cancelled'; reference: string },
    @Request() req: { user: Operator },
  ) {
    return this.operations.orderStatus(
      id,
      body.status,
      body.reference,
      req.user,
    );
  }
  @Post('purchase-orders/:id/receive')
  @RequirePermissions('inventory-edit')
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReceiptInput,
    @Request() req: { user: Operator },
  ) {
    return this.operations.receive(id, body, req.user);
  }
  @Get('batches')
  @RequirePermissions('inventory-edit')
  batches(@Query('productId') id?: string) {
    return this.operations.batches(id ? Number(id) : undefined);
  }
  @Patch('batches/:id')
  @RequirePermissions('inventory-edit')
  batch(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { lotCode: string; expirationDate?: string; reason: string },
    @Request() req: { user: Operator },
  ) {
    return this.operations.updateBatch(id, body, req.user);
  }
  @Post('imports/preview')
  @RequirePermissions('product-edit')
  preview(@Body() body: { csv: string }) {
    return this.imports.preview(body.csv);
  }
  @Post('imports/commit')
  @RequirePermissions('product-edit')
  commit(
    @Body() body: { csv: string; fileHash: string; requestId: string },
    @Request() req: { user: Operator },
  ) {
    return this.imports.commit(body, req.user);
  }
  @Get('shifts')
  @RequirePermissions('sales-edit')
  shifts(@Request() req: { user: Operator }) {
    return this.operations.shifts(req.user);
  }
  @Post('shifts')
  @RequirePermissions('sales-edit')
  open(
    @Body() body: { openingCash: string; drawer: string },
    @Request() req: { user: Operator },
  ) {
    return this.operations.openShift(body, req.user);
  }
  @Post('shifts/:id/cash')
  @RequirePermissions('sales-edit')
  cash(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { amount: string; reason: string; requestId: string },
    @Request() req: { user: Operator },
  ) {
    return this.operations.cashMovement(id, body, req.user);
  }
  @Post('shifts/:id/close')
  @RequirePermissions('sales-edit')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CloseInput,
    @Request() req: { user: Operator },
  ) {
    return this.operations.closeShift(id, body, req.user);
  }
}
