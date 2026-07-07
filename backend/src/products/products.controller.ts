import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import type { ProductSortField } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('name') name?: string,
    @Query('filterIds') filterIds?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterCategories') filterCategories?: string,
    @Query('filterSuppliers') filterSuppliers?: string,
    @Query('filterActive') filterActive?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
  ) {
    return this.productsService.getFilterOptions(field, {
      name,
      filterIds,
      filterNames,
      filterCategories,
      filterSuppliers,
      filterActive,
      filterCreatedDates,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async getProducts(
    @Query('name') name?: string,
    @Query('filterIds') filterIds?: string,
    @Query('filterNames') filterNames?: string,
    @Query('filterCategories') filterCategories?: string,
    @Query('filterSuppliers') filterSuppliers?: string,
    @Query('filterActive') filterActive?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('sortField') sortField?: ProductSortField,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.productsService.getProducts({
      name,
      filterIds,
      filterNames,
      filterCategories,
      filterSuppliers,
      filterActive,
      filterCreatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createProduct(
    @Body() body: CreateProductDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.productsService.createProduct(body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail/:id')
  async getProductById(@Param('id') id: string) {
    return this.productsService.findById(parseInt(id, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateProduct(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.productsService.updateProduct(parseInt(id, 10), body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteProduct(
    @Param('id') id: string,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.productsService.deleteProduct(parseInt(id, 10), req.user);
  }
}