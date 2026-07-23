import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: number; email: string };
    }>();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Permission check requires an authenticated user');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        roles: {
          select: {
            name: true,
            permissions: { select: { name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('User no longer exists');
    }

    if (user.roles.some((role) => role.name === 'Admin')) {
      return true;
    }

    const effectivePermissions = new Set(
      user.roles.flatMap((role) =>
        role.permissions.map((permission) => permission.name),
      ),
    );

    if (
      requiredPermissions.every((permission) =>
        effectivePermissions.has(permission),
      )
    ) {
      return true;
    }

    throw new ForbiddenException(
      `Missing required permission: ${requiredPermissions.join(', ')}`,
    );
  }
}
