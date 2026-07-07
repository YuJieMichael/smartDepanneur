import { Module } from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { DictionaryPageService } from './dictionary-page.service';
import { DictionaryController } from './dictionary.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [PrismaModule, AuditTrailModule],
  controllers: [DictionaryController],
  providers: [DictionaryService, DictionaryPageService],
  exports: [DictionaryService],
})
export class DictionaryModule {}
