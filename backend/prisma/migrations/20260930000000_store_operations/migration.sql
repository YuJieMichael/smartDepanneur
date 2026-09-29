BEGIN;

-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'partially_received';

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "batch_id" INTEGER;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "request_hash" TEXT,
ADD COLUMN     "request_id" TEXT,
ADD COLUMN     "shift_id" INTEGER;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "category_id_snapshot" INTEGER,
ADD COLUMN     "category_name_snapshot" TEXT NOT NULL DEFAULT 'Uncategorized',
ADD COLUMN     "cost_total" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "sent_reference" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "received_quantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "lot_code" TEXT NOT NULL,
    "expiration_date" DATE,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity_received" INTEGER NOT NULL,
    "quantity_remaining" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_batch_allocations" (
    "id" SERIAL NOT NULL,
    "sale_item_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "sale_batch_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" SERIAL NOT NULL,
    "request_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "order_id" INTEGER NOT NULL,
    "received_by_id" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_lines" (
    "id" SERIAL NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "purchase_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_shifts" (
    "id" SERIAL NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "drawer" TEXT NOT NULL DEFAULT 'Main',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opening_cash" DECIMAL(10,2) NOT NULL,
    "counted_cash" DECIMAL(10,2),
    "counted_debit" DECIMAL(10,2),
    "counted_credit" DECIMAL(10,2),
    "counted_other" DECIMAL(10,2),
    "reconciliation" JSONB,
    "notes" TEXT,

    CONSTRAINT "register_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_cash_movements" (
    "id" SERIAL NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "request_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_imports" (
    "id" SERIAL NOT NULL,
    "request_id" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_batches_product_id_expiration_date_idx" ON "stock_batches"("product_id", "expiration_date");

-- CreateIndex
CREATE UNIQUE INDEX "sale_batch_allocations_sale_item_id_batch_id_key" ON "sale_batch_allocations"("sale_item_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_request_id_key" ON "purchase_receipts"("request_id");

-- CreateIndex
CREATE INDEX "purchase_receipts_order_id_idx" ON "purchase_receipts"("order_id");

-- CreateIndex
CREATE INDEX "register_shifts_cashier_id_opened_at_idx" ON "register_shifts"("cashier_id", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "shift_cash_movements_request_id_key" ON "shift_cash_movements"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_imports_request_id_key" ON "product_imports"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_request_id_key" ON "sales"("request_id");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "register_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_batch_allocations" ADD CONSTRAINT "sale_batch_allocations_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_batch_allocations" ADD CONSTRAINT "sale_batch_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_shifts" ADD CONSTRAINT "register_shifts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_cash_movements" ADD CONSTRAINT "shift_cash_movements_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "register_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_imports" ADD CONSTRAINT "product_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing stock as opening batches; unknown expiry remains unknown.
INSERT INTO stock_batches (product_id, lot_code, expiration_date, received_at, quantity_received, quantity_remaining, unit_cost)
SELECT id, 'LEGACY-' || id, expiration_date::date, CURRENT_TIMESTAMP, current_stock, current_stock, cost_price FROM products WHERE current_stock > 0;
-- Historical categories are best-effort snapshots at migration time.
UPDATE sale_items si SET category_id_snapshot = p.category_id, category_name_snapshot = COALESCE(c.name, 'Uncategorized'), cost_total = COALESCE(si.unit_cost, 0) * si.quantity
FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE si.product_id = p.id;
-- Do not reopen historically completed orders as outstanding.
UPDATE purchase_order_items i SET received_quantity = i.quantity FROM purchase_orders o WHERE o.id = i.purchase_order_id AND o.status = 'received';
CREATE UNIQUE INDEX register_shifts_one_open_cashier ON register_shifts(cashier_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX register_shifts_one_open_drawer ON register_shifts(drawer) WHERE closed_at IS NULL;
ALTER TABLE stock_batches ADD CONSTRAINT batch_quantity_nonnegative CHECK (quantity_remaining >= 0 AND quantity_received >= 0 AND quantity_remaining <= quantity_received);
ALTER TABLE purchase_order_items ADD CONSTRAINT receipt_quantity_bounds CHECK (received_quantity >= 0 AND received_quantity <= quantity);
ALTER TABLE sale_batch_allocations ADD CONSTRAINT allocation_quantity_positive CHECK (quantity > 0);
ALTER TABLE purchase_receipt_lines ADD CONSTRAINT receipt_line_positive CHECK (quantity > 0);

COMMIT;
