import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}