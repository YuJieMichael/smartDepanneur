# Daily store operations

This implementation targets one store using `America/Toronto` for business dates. It requires the PostgreSQL API application. The separately published browser-only GitHub Pages demo is unchanged.

## Implemented workflows

| Area | Workflow |
| --- | --- |
| Sales statistics | Toronto business-day boundaries, including daylight saving time; voided sales excluded from reports and product insights; new sales preserve category snapshots and actual batch costs. |
| Purchasing | Generate replenishment drafts, download an order CSV, record manual dispatch, receive part or all of an order, and inspect receipt history. Each receipt creates stock batches and inventory movements in one transaction. |
| Product import | Download the template, preview a UTF-8 CSV, resolve row errors, then confirm an atomic import. Maximum 1 MB and 500 products. Existing SKU/barcode values are rejected; imports only create products. |
| Batch expiry | Track lot, remaining quantity, cost and expiry independently. Checkout consumes earliest-expiring eligible stock first. Expired batches and undated batches of expiry-tracked products cannot be sold. Batch corrections require a reason. |
| Shift reconciliation | Open a drawer with a cash float, record cash additions/withdrawals, then count cash, debit, credit and other payments. Closing records expected amounts, counts and differences; a difference requires a note. |

Checkout requires the current cashier's open shift. A cashier and a drawer can each have only one open shift. Closed shift reports are retained as snapshots. Sales in closed shifts or from an earlier business date cannot be voided through this workflow. A dedicated later-return/refund workflow is not included.

Replenishment suggestions are based on stock and sales; review outstanding orders before sending another order because suggestions do not yet subtract quantities on order.

Sending a purchase order records that the operator sent it manually; it does not send email. Purchase receipts, sale creation, CSV commits and cash movements use request IDs to make retries safe. Receipt quantities cannot exceed outstanding ordered quantities.

Stock totals are derived from batches. Use inventory receipts, adjustments or waste to change quantities; editing a product's aggregate stock or expiry directly is rejected. Stock-bearing products should be deactivated instead of deleted.

## CSV format

Comma-separated UTF-8, optionally with a BOM. Quoted commas and quoted multiline fields are supported. Use the downloadable template headers:

```csv
name,sku,barcode,category,supplier,unit,costPrice,sellingPrice,currentStock,minStock,expirationTracked,expirationDate,lotCode
Demo Milk,DEMO-MILK,000123456789,Demo Dairy,Demo Supplier,unit,2.00,3.50,12,4,true,2027-01-31,DEMO-LOT-1
```

`name`, `costPrice` and `sellingPrice` are required columns. Every row needs a SKU or barcode. Keep barcodes as text in spreadsheet software to retain leading zeroes. Dates use `YYYY-MM-DD`; `expirationTracked` accepts `true` or `false`. Opening stock for an expiry-tracked product requires an expiry date. New category and supplier names are created on confirmation. No records are written during preview, and any validation error prevents the entire import.

## Database and deployment

Use a compatible Node.js 22 release (22.22.3 or newer) and PostgreSQL. Prisma 7 uses `prisma.config.ts` and the PostgreSQL driver adapter; provide `DATABASE_URL` to the backend. Keep database credentials out of frontend environment variables.

Before deploying against an existing database:

1. Back up the database and stop writes from the old application version.
2. Review `backend/prisma/migrations/20260930000000_store_operations/migration.sql` and apply it to a separate staging database first.
3. From `backend`, install dependencies, generate the Prisma client and build:

   ```sh
   npm ci
   npx prisma generate
   npm run build
   ```

4. Apply migrations to the intended database with `npm run migrate:deploy`, then deploy the API and matching frontend together.
5. Reconcile opening stock and fix unknown expiry dates before permitting checkout.

The migration preserves positive aggregate stock as `LEGACY-<productId>` opening batches, using the current product cost and expiry. It cannot reconstruct historical purchase lots. Historical sale category snapshots use the category at migration time; historical costs use the existing sale-item unit cost. Previously completed purchase orders are marked fully received without fabricating receipt records.

Historical sales do not have reconstructed shifts or batch allocations and cannot be voided by the new workflow. Inventory with negative or inconsistent legacy quantities needs manual reconciliation. Expiry-tracked opening batches with unknown expiry remain blocked from sale until corrected.

The database schema migration is transactional and adds quantity constraints and unique indexes for open drawers/cashiers. Do not run demo or owner seed scripts against a live store database. Existing authentication, registration and bootstrap-account policies still need a separate production review before real store use.

## Delivery status

- Backend and frontend production builds completed locally.
- No automated tests were added or run for this change. Existing sale tests and mocks will need adjustment for the required shift/request ID fields and batch transactions.
- The migration has not been applied to a running database. End-to-end checkout, receiving and reconciliation have not been exercised against PostgreSQL.
- These features are not deployed, and the public demonstration site has not changed. Build success alone is not operational acceptance.
- Before store use, validate partial receipt/retry behavior, concurrent stock changes, expiry boundaries, void restoration and reconciliation with representative staging data.
