import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
