import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import type { SupplierSortField } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('api/suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('name') name?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterContactNames') filterContactNames?: string,
    @Query('filterEmails') filterEmails?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
  ) {
    return this.suppliersService.getFilterOptions(field, {
      name,
      filterNames,
      filterContactNames,
      filterEmails,
      filterCreatedDates,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async getSuppliers(
    @Query('name') name?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterContactNames') filterContactNames?: string,
    @Query('filterEmails') filterEmails?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('sortField') sortField?: SupplierSortField,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.suppliersService.getSuppliers({
      name,
      filterNames,
      filterContactNames,
      filterEmails,
      filterCreatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createSupplier(
    @Body() body: CreateSupplierDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.suppliersService.createSupplier(body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail/:id')
  async getSupplierById(@Param('id') id: string) {
    return this.suppliersService.findById(parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateSupplier(
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.suppliersService.updateSupplier(parseInt(id, 10), body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteSupplier(
    @Param('id') id: string,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.suppliersService.deleteSupplier(parseInt(id, 10), req.user);
  }

  @Get()
  async getAllSuppliers() {
    return this.suppliersService.getAllSuppliers();
  }
}