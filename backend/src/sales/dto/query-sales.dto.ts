export type SaleSortField = 'id' | 'saleNumber' | 'total' | 'createdAt';

export class QuerySalesDto {
  filterPaymentMethods?: string;
  filterCreatedDates?: string;
  sortField?: SaleSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
