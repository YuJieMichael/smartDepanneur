import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService public registration', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn() };
  const auditTrail = { create: jest.fn() };

  const service = new AuthService(
    prisma as never,
    jwt as never,
    auditTrail as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [[]],
    [['Admin']],
    [['Inventory Staff']],
    [['Store Owner', 'Cashier']],
  ])('rejects non-public role selection %p', async (roles) => {
    await expect(
      service.register('new@store.local', 'password', roles),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it.each(['Store Owner', 'Cashier'])(
    'registers exactly one allowed %s account',
    async (role) => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 42,
        email: 'new@store.local',
      });

      await expect(
        service.register('new@store.local', 'password', [role]),
      ).resolves.toEqual({
        id: 42,
        email: 'new@store.local',
        message: 'Registered successfully',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@store.local',
          roles: { connect: [{ name: role }] },
        }),
      });
    },
  );

  it('keeps authenticated admin user creation flexible', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 7,
      email: 'inventory@store.local',
    });

    await service.registerWithAudit(
      'inventory@store.local',
      'password',
      ['Inventory Staff'],
      { id: 1, email: 'admin@store.local' },
    );

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roles: { connect: [{ name: 'Inventory Staff' }] },
      }),
    });
    expect(auditTrail.create).toHaveBeenCalled();
  });
});
