import { Module } from '@nestjs/common';
import { JobPostTemplateController } from './job-post-template.controller';
import { JobPostTemplateService } from './job-post-template.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JobPostTemplateController],
  providers: [JobPostTemplateService],
})
export class JobPostTemplateModule {}
