-- Keep cancelled sales for audit purposes while reversing their inventory impact.
ALTER TABLE "sales"
ADD COLUMN "is_voided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "voided_at" TIMESTAMP(3),
ADD COLUMN "void_reason" TEXT,
ADD COLUMN "voided_by_id" INTEGER;

CREATE INDEX "sales_is_voided_created_at_idx"
ON "sales"("is_voided", "created_at");

ALTER TABLE "sales"
ADD CONSTRAINT "sales_voided_by_id_fkey"
FOREIGN KEY ("voided_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
