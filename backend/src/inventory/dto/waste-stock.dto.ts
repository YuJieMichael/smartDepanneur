export class WasteStockDto {
  batchId?: number;
  lotCode?: string;
  expirationDate?: string | null;
  productId!: number;
  quantity!: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
}
