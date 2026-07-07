export type InventoryMovementSortField = 'id' | 'type' | 'quantity' | 'createdAt';

export class QueryInventoryMovementsDto {
  productName?: string;
  filterTypes?: string;
  filterProductNames?: string;
  filterCreatedDates?: string;
  sortField?: InventoryMovementSortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}