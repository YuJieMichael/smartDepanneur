import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesPageService } from './roles-page.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly rolesPageService: RolesPageService,
  ) {}

  // GET /api/roles/filter-options — 需要认证（必须放在 :id 之前）
  @UseGuards(JwtAuthGuard)
  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('name') name?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterPermissions') filterPermissions?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('filterUpdatedDates') filterUpdatedDates?: string,
  ) {
    return this.rolesPageService.getFilterOptions(field, {
      name,
      filterNames,
      filterPermissions,
      filterCreatedDates,
      filterUpdatedDates,
    });
  }

  // GET /api/roles/list — 分页列表（需要认证）
  @UseGuards(JwtAuthGuard)
  @Get('list')
  async getRoles(
    @Query('name') name?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterPermissions') filterPermissions?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('filterUpdatedDates') filterUpdatedDates?: string,
    @Query('sortField') sortField?: 'id' | 'name' | 'createdAt' | 'updatedAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rolesPageService.getRoles({
      name,
      filterNames,
      filterPermissions,
      filterCreatedDates,
      filterUpdatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  // POST /api/roles — 创建角色（需要认证）
  @UseGuards(JwtAuthGuard)
  @Post()
  async createRole(
    @Body() body: { name: string; permissionNames: string[] },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.rolesPageService.createRole(
      { name: body.name, permissionNames: body.permissionNames },
      req.user,
    );
  }

  // GET /api/roles/detail/:id — 获取单个角色（需要认证）
  @UseGuards(JwtAuthGuard)
  @Get('detail/:id')
  async getRole(@Param('id') id: string) {
    return this.rolesPageService.findById(parseInt(id, 10));
  }

  // PATCH /api/roles/:id — 更新角色（需要认证）
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; permissionNames?: string[] },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.rolesPageService.updateRole(
      parseInt(id, 10),
      body,
      req.user,
    );
  }

  // DELETE /api/roles/:id — 删除角色（需要认证）
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteRole(
    @Param('id') id: string,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.rolesPageService.deleteRole(parseInt(id, 10), req.user);
  }

  // GET /api/roles/:name/permissions — 公开接口（必须在 GET() 之前）
  @Get(':name/permissions')
  getPermissions(@Param('name') name: string) {
    return this.rolesService.getPermissionsByRoleName(name);
  }

  // GET /api/roles — 公开接口（获取所有角色简要列表）
  @Get()
  getAllRoles() {
    return this.rolesService.getAllRoles();
  }
}
