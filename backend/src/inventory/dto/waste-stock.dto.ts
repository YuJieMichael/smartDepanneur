export class WasteStockDto {
  productId!: number;
  quantity!: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}