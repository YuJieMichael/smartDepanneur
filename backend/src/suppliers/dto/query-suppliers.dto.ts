export type SupplierSortField = 'id' | 'name' | 'contactName' | 'createdAt' | 'updatedAt';

export class QuerySuppliersDto {
  name?: string;
  filterNames?: string;
  filterContactNames?: string;
  filterEmails?: string;
  filterCreatedDates?: string;
  sortField?: SupplierSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}