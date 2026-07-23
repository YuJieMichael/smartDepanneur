export const VOID_REASON_CODES = [
  'wrong_item',
  'wrong_quantity',
  'duplicate_sale',
  'customer_cancelled',
  'payment_error',
  'other',
] as const;

export type VoidReasonCode = (typeof VOID_REASON_CODES)[number];

export class VoidSaleDto {
  reason?: VoidReasonCode;
  ownerEmail?: string;
  ownerPassword?: string;
}
