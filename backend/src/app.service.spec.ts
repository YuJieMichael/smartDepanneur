import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { AppService } from './app.service';

describe('AppService', () => {
  it('reports a connected database', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const service = new AppService(prisma);

    await expect(service.getHealth()).resolves.toMatchObject({
      status: 'ok',
      database: 'connected',
    });
  });

  it('returns a service-unavailable error when PostgreSQL is down', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as PrismaService;
    const service = new AppService(prisma);

    await expect(service.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
