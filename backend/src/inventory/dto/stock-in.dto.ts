export class StockInDto {
  productId!: number;
  quantity!: number;
  unitCost?: number | string | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}