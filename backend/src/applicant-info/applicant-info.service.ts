import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApplicantInfoService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: number) {
    return this.prisma.applicantInformation.findUnique({ where: { userId } });
  }

  async create(data: {
    email: string;
    phone: string;
    nickname: string;
    country: string;
    state: string;
    address: string;
    postcode: string;
    resume: string;
    userId: number;
  }) {
    return this.prisma.applicantInformation.create({ data });
  }

  async update(userId: number, data: {
    email: string;
    phone: string;
    nickname: string;
    country: string;
    state: string;
    address: string;
    postcode: string;
    resume: string;
  }) {
    return this.prisma.applicantInformation.update({
      where: { userId },
      data,
    });
  }
}
