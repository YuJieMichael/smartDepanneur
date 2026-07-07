export class AdjustStockDto {
  productId!: number;
  quantity!: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}