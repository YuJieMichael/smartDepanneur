export class StockInDto {
  batchId?: number;
  lotCode?: string;
  expirationDate?: string | null;
  productId!: number;
  quantity!: number;
  unitCost?: number | string | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}
