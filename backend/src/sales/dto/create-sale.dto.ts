export interface SaleItemInput {
  productId: number;
  quantity: number;
  unitPrice?: number | string | null;
}

export class CreateSaleDto {
  requestId!: string;
  shiftId!: number;
  items!: SaleItemInput[];
  paymentMethod?: 'cash' | 'debit' | 'credit' | 'other';
  taxRate?: number;
}
