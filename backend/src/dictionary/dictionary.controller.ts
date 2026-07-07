import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { DictionaryPageService } from './dictionary-page.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/dictionary')
export class DictionaryController {
  constructor(
    private readonly dictionaryService: DictionaryService,
    private readonly dictionaryPageService: DictionaryPageService,
  ) {}

  // GET /api/dictionary/filter-options — authenticated
  @UseGuards(JwtAuthGuard)
  @Get('filter-options')
  async getFilterOptions(
    @Query('field') field: string,
    @Query('key') key?: string,
    @Query('filterKeys') filterKeys?: string,
    @Query('filterCategories') filterCategories?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('filterUpdatedDates') filterUpdatedDates?: string,
  ) {
    return this.dictionaryPageService.getFilterOptions(field, {
      key,
      filterKeys,
      filterCategories,
      filterCreatedDates,
      filterUpdatedDates,
    });
  }

  // GET /api/dictionary/list — paginated list (authenticated)
  @UseGuards(JwtAuthGuard)
  @Get('list')
  async getDictionaries(
    @Query('key') key?: string,
    @Query('filterKeys') filterKeys?: string,
    @Query('filterCategories') filterCategories?: string,
    @Query('filterCreatedDates') filterCreatedDates?: string,
    @Query('filterUpdatedDates') filterUpdatedDates?: string,
    @Query('sortField') sortField?: 'id' | 'key' | 'category' | 'createdAt' | 'updatedAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.dictionaryPageService.getDictionaries({
      key,
      filterKeys,
      filterCategories,
      filterCreatedDates,
      filterUpdatedDates,
      sortField,
      sortOrder,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  // POST /api/dictionary — create (authenticated)
  @UseGuards(JwtAuthGuard)
  @Post()
  async createDictionary(
    @Body() body: { key: string; value: string[]; category?: string },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.dictionaryPageService.createDictionary(body, req.user);
  }

  // GET /api/dictionary/detail/:id — get by id (authenticated)
  @UseGuards(JwtAuthGuard)
  @Get('detail/:id')
  async getDictionaryById(@Param('id') id: string) {
    return this.dictionaryPageService.findById(parseInt(id, 10));
  }

  // PATCH /api/dictionary/:id — update (authenticated)
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateDictionary(
    @Param('id') id: string,
    @Body() body: { key?: string; value?: string[]; category?: string },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.dictionaryPageService.updateDictionary(
      parseInt(id, 10),
      body,
      req.user,
    );
  }

  // DELETE /api/dictionary/:id — delete (authenticated)
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteDictionary(
    @Param('id') id: string,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.dictionaryPageService.deleteDictionary(parseInt(id, 10), req.user);
  }

  // GET /api/dictionary — public (findAll or by category)
  @Get()
  findAll(@Query('category') category?: string) {
    if (category) {
      return this.dictionaryService.findByCategory(category);
    }
    return this.dictionaryService.findAll();
  }

  // GET /api/dictionary/:key — public (findByKey)
  @Get(':key')
  findByKey(@Param('key') key: string) {
    return this.dictionaryService.findByKey(key);
  }
}
