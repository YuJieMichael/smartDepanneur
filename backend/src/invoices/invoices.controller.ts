import {
  Body,
  Controller,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvoicesService, type ReceiveInvoiceInput } from './invoices.service';

@Controller('api/invoices')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('inventory-edit')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // The photo is held in memory for this request only and never saved.
  @Post('scan')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  scan(@UploadedFile() file?: Express.Multer.File) {
    return this.invoicesService.scan(file);
  }

  @Post('receive')
  receive(
    @Body() body: ReceiveInvoiceInput,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.invoicesService.receive(body, req.user);
  }
}
