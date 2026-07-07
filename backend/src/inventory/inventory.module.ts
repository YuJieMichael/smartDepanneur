import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}