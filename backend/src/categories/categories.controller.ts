import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import type { CategorySortField } from './dto/query-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Post()
  async createCategory(
    @Body() body: CreateCategoryDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.categoriesService.createCategory(body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail/:id')
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.findById(parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.categoriesService.updateCategory(parseInt(id, 10), body, req.user);
  }

  @UseGuards(JwtAuthGuard)
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