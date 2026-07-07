export type CategorySortField = 'id' | 'name' | 'code' | 'createdAt' | 'updatedAt';

export class QueryCategoriesDto {
  name?: string;
  filterNames?: string;
  filterCodes?: string;
  filterCreatedDates?: string;
  sortField?: CategorySortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}