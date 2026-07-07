import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}