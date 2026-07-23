# Interview Demo Script

Target duration: 4–5 minutes.

## Before the interview

1. Start the stack with `docker compose up --build`.
2. Confirm `http://localhost:3101/api/health` returns `status: ok`.
3. Log in once as the Store Owner and confirm demo data is visible.
4. Keep Dashboard, Sales, Inventory, and Store Agent in browser tabs.

## Story

### 1. Business problem — 30 seconds

“Small depanneur owners already have a cash register, but they still make daily
stock and ordering decisions manually. This project connects sales, inventory,
expiration risk, and reorder recommendations in one workflow.”

### 2. Dashboard — 45 seconds

- Show today’s revenue and estimated profit.
- Point out low-stock and soon-to-expire items.
- Explain that these figures come from PostgreSQL transactions, not hard-coded
  dashboard data.

### 3. Sale and atomic inventory — 60 seconds

- Add an in-stock product to the POS cart.
- Complete the sale.
- Return to Products or Inventory and show the lower quantity.
- Explain that a conditional database update prevents concurrent checkouts
  from creating negative stock and that every sale creates a stock movement.

### 4. Inventory workflow — 45 seconds

- Record stock-in or waste.
- Show the movement in history.
- Mention validation and audit records.

### 5. Store Agent — 60 seconds

- Switch between English, French, and Chinese and show that only the selected
  language's suggestions appear.
- Ask: “What should I restock today?”
- Show the tool trace, product names, current/minimum stock, recent velocity,
  recommended quantity, and estimated cost.
- Explain that OpenAI chooses a read-only store tool before answering and that
  the deterministic local Agent keeps the workflow usable without an API key.

### 6. Engineering close — 30 seconds

- Show the architecture section in the README.
- Mention NestJS, Next.js, Prisma/PostgreSQL, Jest, Docker, CI, and multilingual
  support.
- State the next product increment: purchase-order and lot-level expiration
  tracking.

## Questions to expect

- Why not ask the LLM to calculate inventory directly?
  - Critical numbers remain deterministic and testable; the LLM explains them.
- How is concurrent stock handled?
  - Conditional atomic updates inside a transaction, followed by rollback when
    reservation fails.
- How would this support multiple stores?
  - Add store membership and `storeId` tenant isolation before onboarding.
- Why use a local fallback?
  - A store workflow must remain available during API outages or without an AI
    subscription.
