export class CreateSupplierDto {
  name!: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}