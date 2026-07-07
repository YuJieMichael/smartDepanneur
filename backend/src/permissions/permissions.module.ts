import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
