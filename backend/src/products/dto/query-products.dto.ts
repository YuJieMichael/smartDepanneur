export type ProductSortField =
  | 'id'
  | 'name'
  | 'currentStock'
  | 'sellingPrice'
  | 'createdAt'
  | 'updatedAt';

export class QueryProductsDto {
  name?: string;
  filterIds?: string;
  filterNames?: string;
  filterCategories?: string;
  filterSuppliers?: string;
  filterActive?: string;
  filterCreatedDates?: string;
  sortField?: ProductSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}