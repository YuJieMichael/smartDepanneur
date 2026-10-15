import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { AgentActionsController } from './agent-actions.controller';
import { AgentActionsService } from './agent-actions.service';

@Module({
  imports: [PrismaModule, PurchaseOrdersModule, AuditTrailModule],
  controllers: [AgentActionsController],
  providers: [AgentActionsService],
})
export class AgentActionsModule {}
