export class CreateProductDto {
  name!: string;
  barcode?: string | null;
  sku?: string | null;
  unit?: string;
  currentStock?: number;
  minStock?: number;
  costPrice!: number | string;
  sellingPrice!: number | string;
  expirationTracked?: boolean;
  expirationDate?: string | null;
  isActive?: boolean;
  categoryId?: number | null;
  supplierId?: number | null;
}