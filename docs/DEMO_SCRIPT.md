# Interview Demo Script

Target duration: 6-8 minutes.

## Before the interview

1. Start the stack with `docker compose up --build`.
2. Confirm `http://localhost:3101/api/health` returns `status: ok`.
3. Log in once as the Store Owner and confirm demo data is visible.
4. Keep Dashboard, Sales, Inventory, and Store Agent in browser tabs.
5. Prepare one cashier sale below CAD 100 and one at CAD 100 or more if the
   void-control workflow will be demonstrated.

## Story

### 1. Business problem - 30 seconds

"Small depanneur owners already have a cash register, but they still make daily
stock and ordering decisions manually. This project connects sales, inventory,
exception control, expiration risk, and supplier purchasing in one workflow."

### 2. Dashboard and closeout - 60 seconds

- Show today's revenue and estimated gross profit.
- Show the category sales mix, seven-day revenue/profit trend, and category
  comparison.
- Point out today's void count and amount.
- Point out low-stock and soon-to-expire items.
- Explain that the figures come from PostgreSQL transactions, not hard-coded
  dashboard data.
- Generate the daily closeout table and show the CSV download action.

### 3. Sale, history, and safe void - 90 seconds

- Log in as Cashier.
- Add an in-stock product to the POS cart and complete the sale.
- Show the transaction in the recent-sales history.
- Explain that a cashier can void only their own sales within ten minutes and
  must select a reason.
- For a sale of CAD 100 or more, show the Owner confirmation requirement.
- Void the sale and show the reason, operator, approver, and restored stock.
- Explain that conditional database updates prevent concurrent checkouts from
  creating negative stock and that both sale and void movements are
  transactional.

### 4. Inventory workflow - 45 seconds

- Log in as Store Owner.
- Record stock-in or waste.
- Show the movement in history.
- Mention validation, role permissions, and audit records.

### 5. Store Agent and purchasing - 90 seconds

- Switch between English, French, and Chinese and show that navigation keeps
  the selected language.
- Show that only the selected language's suggested questions appear.
- Ask: "What should I restock today?"
- Show the tool trace, product names, current/minimum stock, recent velocity,
  recommended quantity, and estimated cost.
- Explain that OpenAI chooses a read-only business tool and that the
  deterministic local Agent keeps the workflow usable without an API key.
- Generate the purchase orders and show the supplier-grouped drafts,
  quantities, unit costs, supplier contacts, and totals.
- Repeat the action and explain that the same day's drafts are updated instead
  of duplicated.

### 6. Engineering close - 45 seconds

- Show `docs/PROJECT_UPDATES.md` and the architecture section in the README.
- Mention NestJS, Next.js, Prisma/PostgreSQL, Jest, Docker, GitHub Actions,
  RBAC, auditability, and multilingual support.
- State the next product increment: supplier sending, receiving, and lot-level
  expiration tracking.

## Questions to expect

- Why not ask the LLM to calculate inventory directly?
  - Critical numbers remain deterministic and testable; the LLM explains them.
- How is concurrent stock handled?
  - Conditional atomic updates inside a transaction, followed by rollback when
    a reservation fails.
- Why is an Owner needed for a large cashier void?
  - The API verifies an authorized Owner for CAD 100+ cashier exceptions while
    preserving the cashier, reason, and approver in the audit history.
- How are duplicate purchase orders prevented?
  - The order number is derived from the Toronto business date and supplier;
    same-day generation updates that draft.
- How would this support multiple stores?
  - Add store membership and `storeId` tenant isolation before onboarding.
- Why use a local Agent fallback?
  - A store workflow must remain available during API outages or without an AI
    subscription.
