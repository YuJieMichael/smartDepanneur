import { ForbiddenException } from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service';

describe('AuditTrailService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    auditTrail: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new AuditTrailService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditTrail.count.mockReturnValue('count-query');
    prisma.auditTrail.findMany.mockReturnValue('list-query');
    prisma.$transaction.mockResolvedValue([1, [{ id: 10 }]]);
  });

  it('allows non-admin users with permission to read store audit records', async () => {
    prisma.user.findUnique.mockResolvedValue({
      roles: [{ name: 'Store Owner' }],
    });

    await expect(service.findByRecord('suppliers', 12, 7)).resolves.toEqual({
      total: 1,
      list: [{ id: 10 }],
      page: 1,
      pageSize: 10,
    });
  });

  it('blocks non-admin users from administrative audit records', async () => {
    prisma.user.findUnique.mockResolvedValue({
      roles: [{ name: 'Store Owner' }],
    });

    await expect(service.findByRecord('users', 12, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows admins to read administrative audit records', async () => {
    prisma.user.findUnique.mockResolvedValue({
      roles: [{ name: 'Admin' }],
    });

    await expect(service.findByRecord('users', 12, 1)).resolves.toMatchObject({
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });
});
