import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.dictionary.findMany({ orderBy: { key: 'asc' } });
  }

  async findByKey(key: string) {
    return this.prisma.dictionary.findUnique({ where: { key } });
  }

  async findByCategory(category: string) {
    return this.prisma.dictionary.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }
}
