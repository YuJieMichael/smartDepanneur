-- AlterTable
ALTER TABLE "sales" ADD COLUMN "void_approved_by_id" INTEGER;

-- CreateIndex
CREATE INDEX "sales_void_approved_by_id_idx" ON "sales"("void_approved_by_id");

-- CreateIndex
CREATE INDEX "sales_is_voided_voided_at_idx" ON "sales"("is_voided", "voided_at");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_void_approved_by_id_fkey" FOREIGN KEY ("void_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
