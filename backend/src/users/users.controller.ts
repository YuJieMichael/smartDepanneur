import { Body, Controller, Delete, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('email') email?: string,
    @Query('filterIds') filterIds?: string,
    @Query('filterEmails') filterEmails?: string,
    @Query('filterRoles') filterRoles?: string,
    @Query('filterDates') filterDates?: string,
  ) {
    return this.usersService.getFilterOptions(field, {
      email,
      filterIds,
      filterEmails,
      filterRoles,
      filterDates,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUsers(
    @Query('email') email?: string,
    @Query('filterIds') filterIds?: string,
    @Query('filterEmails') filterEmails?: string,
    @Query('filterRoles') filterRoles?: string,
    @Query('filterDates') filterDates?: string,
    @Query('sortField') sortField?: 'id' | 'email' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.usersService.getUsers({
      email,
      filterIds,
      filterEmails,
      filterRoles,
      filterDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { email?: string; roles?: string[] },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.usersService.updateUser(
      parseInt(id, 10),
      { email: body.email, roleNames: body.roles },
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.usersService.deleteUser(parseInt(id, 10), req.user);
  }
}
