# SmartDepanneur Current Project Updates

Updated: July 23, 2026

This document records the functionality implemented on
`agent/store-agent-i18n` after the portfolio-hardening release. It separates
finished work from the next product increments so the repository, pull
request, demo, and resume all make the same claims.

## Release summary

SmartDepanneur now supports the complete daily loop for a small convenience
store:

1. A cashier completes a sale.
2. Inventory is deducted atomically.
3. Recent sales remain visible and a permitted mistake can be voided safely.
4. The owner sees revenue, estimated gross profit, category performance,
   trends, and void activity.
5. The Store Agent calculates reorder recommendations in the selected
   language.
6. The owner generates supplier-grouped draft purchase orders with one click.
7. At closing time, the owner generates a daily closeout table and downloads
   it as CSV.

## Implemented updates

### Persistent English, French, and Chinese

- The selected `en`, `fr`, or `zh` locale is stored in browser local storage,
  so changing routes no longer resets the interface to English.
- Ant Design components and the document language follow the same selection.
- Store Agent questions, answers, reorder reasons, purchase-order text, and the
  new sales controls use the selected language.

Key implementation:

- `frontend/lib/i18n/index.ts`
- `frontend/app/providers.tsx`
- `backend/src/insights/dto/ask-insight.dto.ts`
- `backend/src/insights/insights.service.ts`

### Owner and cashier onboarding

- Public registration accepts exactly one role: `Store Owner` or `Cashier`.
- The login page exposes only the Store Owner and Cashier demo shortcuts.
- A cashier is routed directly to checkout and cannot open owner dashboards,
  inventory-management screens, products, suppliers, or Store Agent pages.
- Checkout still updates stock automatically, so the cashier completes the
  sale while the system performs the inventory movement.
- Owners retain the full store-management workflow.

The role restriction is enforced by both the UI and API rather than only
hiding menu items.

Key implementation:

- `backend/src/auth/auth.service.ts`
- `backend/src/access-control/permission.guard.ts`
- `backend/prisma/seed.mjs`
- `frontend/app/login/login-form.tsx`
- `frontend/components/common/auth-guard.tsx`
- `frontend/components/layout/left-menu.tsx`

### Dashboard analytics and daily closeout

- Dashboard cards show today's revenue, estimated gross profit, sale count,
  low-stock risk, and expiration risk.
- A category sales-mix donut chart shows where revenue came from.
- A seven-day chart compares revenue and estimated gross profit.
- A category comparison chart displays sales and profit together.
- Quick actions use a compact two-by-two grid.
- The dashboard now shows today's void count and void amount.
- One click generates a daily closeout table with:
  - revenue;
  - estimated gross profit;
  - completed sale count;
  - sales, profit, and margin for every category.
- The closeout table can be downloaded as CSV.

API endpoints:

- `GET /api/dashboard/overview`
- `GET /api/dashboard/daily-closeout`
- `GET /api/dashboard/sales-trend`

Key implementation:

- `backend/src/dashboard/dashboard.service.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/components/store/donut-chart.tsx`
- `frontend/components/store/sales-trend-chart.tsx`
- `frontend/components/store/category-performance-chart.tsx`

### Sales history and controlled voids

- Recent sales appear below checkout.
- A void always requires one of these reason codes:
  - `wrong_item`;
  - `wrong_quantity`;
  - `duplicate_sale`;
  - `customer_cancelled`;
  - `payment_error`;
  - `other`.
- A cashier can see and void only their own sales, and only during the first
  ten minutes.
- A Store Owner or Administrator can void any non-voided sale without the
  cashier time limit.
- A cashier void of CAD 100 or more requires a Store Owner or Administrator
  email and password confirmation.
- Owner credentials are verified with bcrypt and are never stored in the sale
  or audit record.
- A successful void restores stock in the same database transaction, records
  `return_item` inventory movements, and preserves the original sale.
- The history records who voided the sale, why it was voided, and who approved
  a large cashier void.

API endpoint:

- `POST /api/sales/:id/void`

Key implementation:

- `backend/src/sales/dto/void-sale.dto.ts`
- `backend/src/sales/sales.service.ts`
- `frontend/app/sales/page.tsx`
- `backend/prisma/migrations/20260723190000_add_sale_voiding/migration.sql`
- `backend/prisma/migrations/20260723233000_add_void_approver/migration.sql`

### Multilingual Store Agent

- The former AI Insights experience is presented as a Store Agent.
- Critical calculations remain deterministic:
  - reorder quantities;
  - top sellers;
  - slow movers;
  - store summaries.
- OpenAI Responses API tool calling can select those read-only business tools
  and explain their results.
- If no API key is configured, the API times out, or the provider fails, a
  deterministic local Agent returns a usable answer.
- Suggested questions and answers use only the interface language selected by
  the user.
- Reorder recommendations include localized operational reasons instead of
  falling back to English.

Key implementation:

- `backend/src/insights/insights.service.ts`
- `backend/src/insights/insights.service.spec.ts`
- `frontend/app/insights/page.tsx`

### One-click draft purchase orders

- The owner can generate purchase orders directly from the current reorder
  recommendations.
- Items are grouped by supplier.
- Every draft includes supplier contact details, item quantity, unit cost,
  line total, and estimated order total.
- The order number is deterministic for the Toronto business date and
  supplier.
- Repeating the action on the same day updates the existing supplier draft
  instead of creating duplicates.
- Users require `inventory-edit`; cashiers cannot generate purchase orders.
- Draft generation and updates are written to the audit trail.

API endpoint:

- `POST /api/purchase-orders/generate-from-reorder?language=en|fr|zh`

Key implementation:

- `backend/src/purchase-orders/purchase-orders.controller.ts`
- `backend/src/purchase-orders/purchase-orders.service.ts`
- `backend/src/purchase-orders/purchase-orders.service.spec.ts`
- `frontend/app/insights/page.tsx`
- `backend/prisma/migrations/20260723220000_add_purchase_orders/migration.sql`

## Database changes

### Sale void fields

`Sale` now stores:

- `isVoided`
- `voidedAt`
- `voidReason`
- `voidedById`
- `voidApprovedById`

Indexes support current-day void reporting, sale history, cashier lookup, and
approver lookup.

### Purchase orders

The schema now includes:

- `PurchaseOrder`
  - supplier;
  - creator;
  - Toronto business date;
  - `draft`, `sent`, `received`, or `cancelled` status;
  - estimated total.
- `PurchaseOrderItem`
  - product;
  - snapshot product name, SKU, and unit;
  - quantity;
  - unit cost;
  - line total.

The snapshot fields keep a draft understandable even if product details later
change.

See `backend/prisma/schema.prisma` and the three July 23 migrations listed
above.

## Security and reliability

- JWT protects store APIs.
- A permission guard enforces RBAC on the backend.
- Public registration cannot assign privileged or legacy roles.
- Sales use conditional atomic stock decrements inside a Prisma transaction,
  preventing concurrent checkouts from taking stock below zero.
- Voids restore all item quantities atomically.
- Large cashier void approval is verified server-side.
- `DATABASE_URL` and a JWT secret of at least 32 characters are validated at
  startup.
- OpenAI is optional and bounded by a twelve-second timeout.
- Important operational actions create audit records.

## Docker, AWS, and CI/CD

- `docker-compose.yml` starts PostgreSQL, applies migrations, seeds the
  idempotent demo dataset, and starts the backend and frontend.
- The backend and frontend have separate production-style Dockerfiles.
- `.github/workflows/build.yml` runs:
  - Prisma generation and schema validation;
  - backend and frontend typechecking;
  - ESLint;
  - backend Jest tests;
  - production builds;
  - Docker Compose validation;
  - backend and frontend image builds.
- `.github/dependabot.yml` monitors dependencies.
- `docs/DEPLOYMENT_AWS.md` documents an AWS target using CloudFront, ALB, ECS
  Fargate, RDS PostgreSQL, Secrets Manager, CloudWatch, ECR, and GitHub OIDC.

## Validation completed

- Backend Jest suite: 41 tests passed.
- Backend: typecheck, lint, and production build passed.
- Frontend: typecheck, lint, and production build passed.
- Docker migrations and application startup passed.
- Browser-tested cashier checkout and inventory deduction.
- Browser-tested persistent language selection.
- Browser-tested daily closeout generation and CSV action.
- Browser-tested supplier grouping and repeat-click purchase-order updates.
- Browser-tested a CAD 119.42 cashier void requiring successful owner
  confirmation, stock restoration, history audit details, and dashboard void
  totals.

Test coverage for these updates is concentrated in:

- `backend/src/access-control/permission.guard.spec.ts`
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/dashboard/dashboard.service.spec.ts`
- `backend/src/insights/insights.service.spec.ts`
- `backend/src/purchase-orders/purchase-orders.service.spec.ts`
- `backend/src/sales/sales.service.spec.ts`

## Recommended demo flow

1. Log in as Cashier and complete a small sale.
2. Show the new sale in history and explain the ten-minute cashier window.
3. Create or select a sale of CAD 100 or more, choose a required reason, and
   demonstrate Owner confirmation.
4. Log in as Store Owner.
5. Show the dashboard charts and today's void count and amount.
6. Generate the daily closeout table and download its CSV.
7. Open Store Agent, switch among EN, FR, and ZH, and ask what should be
   restocked.
8. Generate the supplier-grouped draft purchase orders.
9. Click the action again and show that existing daily drafts are updated,
   not duplicated.

Seeded demo credentials are listed in the main `README.md`.

## Current boundaries

Completed:

- single-store daily operations;
- sales and automatic stock deduction;
- controlled sale voids with audit history;
- dashboard analytics and daily closeout;
- multilingual Store Agent;
- supplier-grouped draft purchase-order generation.

Not yet completed:

- sending purchase orders to suppliers;
- partial receiving and receiving drafts into stock;
- lot-level expiration and first-expiring-first-out deduction;
- multi-store tenant isolation;
- POS imports, invoice OCR, and shelf-photo recognition;
- PostgreSQL integration tests and Playwright CI tests;
- production AWS infrastructure as code.

## Resume positioning

Recommended project title:

**SmartDepanneur Agent — Multilingual Retail Operations and Replenishment
Platform**

Recommended resume bullets:

- Built a full-stack convenience-store operations platform with Next.js,
  NestJS, PostgreSQL, Prisma, and Docker, covering checkout, atomic inventory,
  dashboard analytics, daily closeout, supplier purchasing, and audited
  role-based workflows.
- Implemented safe sale void controls with mandatory reasons, cashier
  ownership and time limits, server-verified owner approval for CAD 100+
  refunds, atomic stock restoration, and daily exception metrics.
- Developed a multilingual Store Agent that combines deterministic retail
  calculations with OpenAI tool calling and a resilient local fallback, then
  converts reorder recommendations into idempotent supplier-grouped purchase
  order drafts.
- Automated typechecking, linting, Jest tests, production builds, Compose
  validation, and container image builds through GitHub Actions.
