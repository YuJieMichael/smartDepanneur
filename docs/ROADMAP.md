# Product Roadmap

## Portfolio release — complete

- Products, categories, and suppliers
- POS-style sales with atomic inventory deduction
- Stock-in, adjustment, waste, and movement history
- Dashboard, low-stock, and expiration alerts
- Reorder, top-seller, and slow-mover analysis
- OpenAI explanation with local fallback
- JWT authentication, RBAC, and audit trail
- EN / FR / ZH interfaces
- Docker stack, tests, CI, and deployment documentation

## Phase 1: purchasing and expiration lots - in progress

- [x] Add `PurchaseOrder` and `PurchaseOrderItem`
- [x] Convert reorder suggestions into supplier-grouped draft orders
- [x] Make same-day draft generation idempotent
- [ ] Add draft review, edit, send, and cancellation screens
- Receive an order into `InventoryLot`
- Move expiration date and unit cost from product-level state to lots
- Deduct inventory using first-expiring-first-out
- Add supplier price history and partial receiving

Exit criterion: the store can move from recommendation to order to receiving
without re-entering quantities.

## Phase 2: multi-store SaaS

- Add `Organization`, `Store`, and `StoreMember`
- Add and backfill `storeId` on all operational tables
- Enforce tenant scope in services and tests
- Per-store timezone, tax, currency, and reorder configuration
- Owner portfolio and staff invitation workflows

Exit criterion: automated tests prove one store can never read or mutate
another store’s records.

## Phase 3: data integrations

- Generic POS CSV import with mapping and validation
- Scheduled sales import
- Supplier invoice OCR with human confirmation
- Barcode scanner and mobile receiving UI
- Weather and holiday signals for demand forecasting

Exit criterion: a pilot store can operate for one week without manual duplicate
entry.

## Phase 4: shelf vision

- Shelf-photo upload with consent and retention controls
- Product/facing recognition with confidence thresholds
- Human-confirmed empty-shelf alerts
- Accuracy and drift evaluation dataset

Vision comes after the sales-to-purchase loop because it has higher operational
and evaluation cost.

## Engineering backlog

- Remove the remaining recruitment-scaffold modules after data migration
- Increase service-level test coverage
- Add PostgreSQL integration and Playwright browser tests
- Generate OpenAPI documentation
- Add structured logging, request IDs, and metrics
- Add Sentry/OpenTelemetry and AI cost dashboards
