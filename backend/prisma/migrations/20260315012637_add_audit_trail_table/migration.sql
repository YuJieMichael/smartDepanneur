-- CreateTable
CREATE TABLE "audit_trails" (
    "id" SERIAL NOT NULL,
    "table" TEXT NOT NULL,
    "record_id" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "user_id" INTEGER NOT NULL,
    "user_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_trails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_trails_table_record_id_idx" ON "audit_trails"("table", "record_id");
