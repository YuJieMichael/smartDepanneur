import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import type { CategorySortField } from './dto/query-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('api/categories')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('product-edit')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('name') name?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterCodes') filterCodes?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
  ) {
    return this.categoriesService.getFilterOptions(field, {
      name,
      filterNames,
      filterCodes,
      filterCreatedDates,
    });
  }

  @Get('list')
  async getCategories(
    @Query('name') name?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterCodes') filterCodes?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('sortField') sortField?: CategorySortField,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.categoriesService.getCategories({
      name,
      filterNames,
      filterCodes,
      filterCreatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post()
  async createCategory(
    @Body() body: CreateCategoryDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.categoriesService.createCategory(body, req.user);
  }

  @Get('detail/:id')
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.findById(parseInt(id, 10));
  }

  @Patch(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.categoriesService.updateCategory(parseInt(id, 10), body, req.user);
  }

  @Delete(':id')
  async deleteCategory(
    @Param('id') id: string,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.categoriesService.deleteCategory(parseInt(id, 10), req.user);
  }

  @Get()
  async getAllCategories() {
    return this.categoriesService.getAllCategories();
  }
}
