import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const guard = new PermissionGuard(reflector as never, prisma as never);
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 2, email: 'cashier@store.local' } }),
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows routes without permission metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows a cashier to create sales', async () => {
    reflector.getAllAndOverride.mockReturnValue(['sales-edit']);
    prisma.user.findUnique.mockResolvedValue({
      roles: [
        {
          name: 'Cashier',
          permissions: [{ name: 'sales-edit' }],
        },
      ],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks a cashier from dashboard and inventory permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(['dashboard-view']);
    prisma.user.findUnique.mockResolvedValue({
      roles: [
        {
          name: 'Cashier',
          permissions: [{ name: 'sales-edit' }],
        },
      ],
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows Admin to access protected store routes', async () => {
    reflector.getAllAndOverride.mockReturnValue(['insights-view']);
    prisma.user.findUnique.mockResolvedValue({
      roles: [{ name: 'Admin', permissions: [] }],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
