import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllRoles() {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async getPermissionsByRoleName(name: string) {
    const role = await this.prisma.role.findUnique({
      where: { name },
      select: {
        id: true,
        name: true,
        permissions: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`角色 "${name}" 不存在`);
    }

    return role;
  }
}
