import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesPageService } from './roles-page.service';
import { RolesController } from './roles.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [RolesController],
  providers: [RolesService, RolesPageService],
})
export class RolesModule {}
