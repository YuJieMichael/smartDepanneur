import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('view-admin')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // GET /api/permissions/all — 公开接口（获取所有权限简要列表）
  @Get('all')
  getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('name') name?: string,
    @Query('filterCodes') filterCodes?: string,
    @Query('filterRoles') filterRoles?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('filterUpdatedDates') filterUpdatedDates?: string,
  ) {
    return this.permissionsService.getFilterOptions(field, {
      name,
      filterCodes,
      filterRoles,
      filterCreatedDates,
      filterUpdatedDates,
    });
  }

  @Get()
  async getPermissions(
    @Query('name') name?: string,
    @Query('filterCodes') filterCodes?: string,
    @Query('filterRoles') filterRoles?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('filterUpdatedDates') filterUpdatedDates?: string,
    @Query('sortField') sortField?: 'id' | 'name' | 'createdAt' | 'updatedAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.permissionsService.getPermissions({
      name,
      filterCodes,
      filterRoles,
      filterCreatedDates,
      filterUpdatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post()
  async createPermission(
    @Body() body: { name: string; roles: string[] },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.permissionsService.createPermission(
      { name: body.name, roleNames: body.roles },
      req.user,
    );
  }

  @Get(':id')
  async getPermission(@Param('id') id: string) {
    return this.permissionsService.findById(parseInt(id, 10));
  }

  @Patch(':id')
  async updatePermission(
    @Param('id') id: string,
    @Body() body: { roles?: string[] },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.permissionsService.updatePermission(
      parseInt(id, 10),
      { roleNames: body.roles },
      req.user,
    );
  }

  @Delete(':id')
  async deletePermission(
    @Param('id') id: string,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.permissionsService.deletePermission(parseInt(id, 10), req.user);
  }
}
