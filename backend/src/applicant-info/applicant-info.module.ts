import { Module } from '@nestjs/common';
import { ApplicantInfoController } from './applicant-info.controller';
import { ApplicantInfoService } from './applicant-info.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ApplicantInfoController],
  providers: [ApplicantInfoService],
})
export class ApplicantInfoModule {}
