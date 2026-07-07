export interface SaleItemInput {
  productId: number;
  quantity: number;
  unitPrice?: number | string | null;
}

export class CreateSaleDto {
  items!: SaleItemInput[];
  paymentMethod?: 'cash' | 'debit' | 'credit' | 'other';
  taxRate?: number;
}
