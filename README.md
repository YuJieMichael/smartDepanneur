# SmartDepanneur Agent

Agent-assisted inventory, sales, expiration, and replenishment software for
Quebec convenience stores.

SmartDepanneur is a full-stack portfolio project based on real depanneur
workflows. A cashier can complete a sale, inventory is deducted atomically,
the dashboard updates store metrics, and the insight engine turns recent
sales and stock levels into practical reorder recommendations.

## Latest project update

The current branch adds persistent EN/FR/ZH selection, Owner/Cashier
onboarding, dashboard charts, a one-click daily closeout report, controlled
sale voids, localized Store Agent guidance, and one-click supplier-grouped
purchase-order drafts.

See [Current project updates](docs/PROJECT_UPDATES.md) for the implemented
workflow, permission rules, database migrations, validation evidence, demo
steps, known boundaries, and resume positioning.

## What it demonstrates

- Real retail-domain modelling instead of generic CRUD
- Next.js and React application architecture
- NestJS REST APIs with JWT authentication and RBAC
- PostgreSQL transactions through Prisma
- Atomic stock updates that prevent negative inventory
- OpenAI Responses API tool calling with a deterministic local Agent fallback
- The same Store Agent tools served to any MCP client over stdio
- Agent actions gated by owner approval: the agent proposes, a person decides
- A weekday-aware demand forecast, backtested against the old rule
- Supplier invoices read by a vision model and reviewed before stock-in
- English, French, and Simplified Chinese user interfaces
- Repeatable Docker development and production-style builds
- Automated typechecking, linting, tests, builds, and container validation
- A trilingual agent eval with routing, language, and grounding checks

## Core workflow

```mermaid
flowchart LR
  A["Cashier creates sale"] --> B["NestJS validates active products"]
  B --> C["Atomic PostgreSQL stock reservation"]
  C --> D["Sale + items + movements committed"]
  D --> E["Dashboard metrics update"]
  E --> F["Reorder engine recalculates demand"]
  F --> G["Store Agent selects business tools"]
```

## Features

### Store operations

- Product catalogue with barcode, SKU, category, supplier, unit, cost, price,
  minimum stock, and expiration settings
- Stock-in, manual adjustment, waste, return, and sales movement history
- Supplier invoice photo or PDF read into a reviewable receipt: catalogue
  matching, cost-change flags, duplicate-invoice protection, and one-transaction
  stock-in after the owner confirms
- POS-style checkout with Quebec tax, payment method, estimated profit, and
  automatic inventory deduction
- Checkout category filtering with product counts and name, barcode, or SKU
  search
- Recent sale history with reason-required, auditable voids that restore stock
- Cashier void ownership and ten-minute controls, plus Owner approval for
  cashier voids of CAD 100 or more
- Low-stock, out-of-stock, and expiration alerts
- Dashboard sales mix, seven-day trend, category comparison, void metrics, and
  operational alerts
- One-click daily closeout table and CSV with revenue, gross profit, sale
  count, and category performance
- Audit records for important operational changes

### Store Agent

- Reorder quantities from a 14-day weekday-aware demand forecast (seven-day
  average for products with under two weeks of history)
- Top-seller, slow-mover, expiry-risk, and minimum-stock analysis
- Six read-only tools (reorder suggestions, top sellers, slow movers, store
  summary, expiry risks, minimum stock review) and two proposal tools
  (purchase-order drafts, minimum stock change)
- Proposals wait under Pending actions until the Store Owner approves or
  rejects them; nothing the agent proposes changes data on its own
- Expiry risks: perishables forecast not to sell before their date, with units
  and cost at risk and a markdown that deepens as the date nears
- Minimum stock review: minimums that no longer match forecast demand over the
  supplier lead time, with a recommended value staff can propose
- OpenAI function calling chooses the business tools needed for each question
- The selected UI language (`en`, `fr`, or `zh`) controls both suggested
  questions and the answer language
- Deterministic multilingual local Agent when the API is unavailable
- Logged provider, model, selected language, tools used, result, and fallback
  reason
- Twelve-second timeout so an OpenAI outage does not block store operations
- One-click generation of idempotent supplier-grouped purchase-order drafts
  from the current reorder plan

### Security and reliability

- JWT-protected store APIs
- Role and permission management
- Public self-registration restricted to Store Owner or Cashier
- Cashier access restricted to checkout; sales update inventory automatically
- Server-enforced sale void ownership, time window, reason, and large-void
  approval rules
- Agent proposals need the `agent-actions-approve` permission (Store Owner);
  each approval is claimed atomically, runs once, re-checks for changes made
  since the proposal, and is audited
- Required environment validation at startup
- No hard-coded production JWT fallback
- Conditional database updates that prevent concurrent sales or adjustments
  from taking stock below zero
- Database-aware health endpoint at `/api/health`
- Production startup is separated from migrations and demo seeding

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Ant Design, Tailwind CSS, Zustand |
| Backend | NestJS 11, Node.js 22, Passport JWT, REST |
| Data | PostgreSQL 16, Prisma 5 |
| Agent | OpenAI Responses API function calling with local Agent fallback, MCP server (stdio) |
| Delivery | Docker Compose, GitHub Actions, Dependabot |

## Run with Docker

Requirements: Docker Desktop with Docker Compose.

```bash
docker compose up --build
```

Open:

- Application: `http://localhost:3100`
- Backend health: `http://localhost:3101/api/health`
- PostgreSQL: `localhost:5432`

The local Compose environment applies migrations and installs idempotent demo
data. Production containers do not seed data automatically.

To enable OpenAI-generated explanations:

```powershell
$env:OPENAI_API_KEY="your-key"
docker compose up --build
```

## Run without Docker

Start PostgreSQL, then configure the backend:

```powershell
Copy-Item backend/.env.example backend/.env
```

Install, migrate, and seed:

```powershell
cd backend
npm install
npm run migrate:deploy
npm run seed
npm run seed:demo
npm run start:dev
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Default ports are frontend `3100`, backend `3101`, and PostgreSQL `5432`.

## Store Agent tools over MCP

The Store Agent tools are also served over the
[Model Context Protocol](https://modelcontextprotocol.io), so an owner can ask
Claude Desktop, Claude Code, or any MCP client about live store data without
opening the app. The MCP server and the in-app agent share one tool
definition list (`STORE_AGENT_TOOLS`), so both always expose the same tools.

```powershell
cd backend
npm run build
npm run mcp      # stdio server; needs DATABASE_URL
```

Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "smartdepanneur": {
      "command": "node",
      "args": ["C:/path/to/smartDepanneur/backend/dist/src/mcp/main.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/depanneur"
      }
    }
  }
}
```

The MCP process loads only Prisma and the insight service: no HTTP routes and
no JWT secret. The six analysis tools are annotated read-only. The two
`propose_*` tools only record a pending proposal, so an MCP client can
suggest a purchase order or a minimum stock change, but only the owner can
approve it in the app.

## Store Agent eval

`npm run eval:agent` (in `backend/`) scores the Store Agent on 133 owner
questions in English, French, and Chinese against an in-memory fixture store,
so it needs neither PostgreSQL nor an API key. Each answer is checked for:

- **Routing**: the agent called the tool the question needs
- **Language**: the answer is in the selected UI language
- **Grounding**: every product it names came back from a tool it called
- **Required facts**: it surfaces the fixture's key fact (for example, the
  out-of-stock product for a restocking question), and an action request ends
  in a pending proposal

Cases come in four splits: `dev` (may guide changes), `holdout` (written
alongside dev, never tuned on), `blind` (written by a separate model from a
description of the tools, without seeing any agent code), and `blind-v2`
(the same, for the expiry, minimum stock and proposal tools; the developer read
it before writing those rules, so it is a weaker check than `blind`).

The first run showed the deterministic fallback agent, which answers whenever
OpenAI is unavailable, routed only 42% of questions correctly: "Are we running
out of anything?" got a generic store summary. Replacing single keywords with
multilingual intent groups raised the original 78 cases to:

| Split | Cases | Before | After |
| --- | --- | --- | --- |
| dev | 30 | 46.7% | 100% |
| holdout | 12 | 25.0% | 100% |
| blind | 36 | 44.4% | 66.7% |
| overall | 78 | 42.3% | 84.6% |

With the expiry, minimum stock and proposal tools added, all 133 cases route
90.2% correctly: dev and holdout 100%, `blind` 66.7% (unchanged), and
`blind-v2` 96.3%.

The blind failures are idiomatic phrasings ("What's flying off the shelves?",
"rendus à sec") that keyword rules cannot cover; that gap is why the LLM agent
is primary. A Jest test keeps these scores from regressing in CI.

`npm run eval:agent -- --agent=openai` runs the same cases against the live
OpenAI agent (needs `OPENAI_API_KEY`) and adds fallback rate and latency.
Reports are written to `backend/eval/results/`.

## Demand forecast backtest

Reorder quantities used to spread the last seven days evenly over the next 14,
which under-orders before weekends, when a depanneur sells most of its beer,
ice and chips. The forecast now multiplies a deseasonalized 28-day level by a
weekday profile, computed on completed store days in Montreal time.

`npm run eval:forecast` backtests both rules with the app's reorder policy
(two-day supplier lead time) on simulated demand: nine depanneur-like products,
30 random seeds, 84 test days each.

| Metric | 7-day average | Weekday forecast |
| --- | --- | --- |
| 7-day forecast error (WAPE) | 35.3% | 28.2% |
| Fill rate | 97.7% | 98.7% |
| Lost sales per run | 131 units | 73 units (-44.5%) |
| Average units on hand | 55.3 | 54.4 |

Products without a weekday rhythm (milk, cigarettes) score the same under both
rules. The demand is synthetic, so this shows the method works on weekday
seasonal demand; it is not a measurement from a real store.

## Supplier invoice scanning

Inventory > Scan invoice reads a photo (JPEG, PNG, WebP, GIF) or PDF with an
OpenAI vision model and strict structured output. Each line is matched to the
catalogue by SKU or barcode, then by a name similarity that handles French and
English supplier wording, accents, sizes and pack counts. Lines whose unit cost
moved more than 5% are flagged. Nothing is stocked until the owner reviews the
lines and confirms; the receipt is one transaction, audited, and an invoice
number can be received only once per supplier.

Scanning needs `OPENAI_API_KEY` (and optionally `OPENAI_VISION_MODEL`);
without it the scanner explains why and manual stock-in still works.

## Demo accounts

Demo credentials exist only in seeded demo environments.

| Role | Email | Password |
| --- | --- | --- |
| Store Owner | `owner@smartdepanneur.local` | `123456` |
| Cashier | `cashier@smartdepanneur.local` | `123456` |

Never run `seed:demo` against a production database.

## Quality checks

Run the same checks used in CI:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Current backend tests cover:

- Required environment and secret validation
- Database health behaviour
- Atomic sale stock reservation
- Controlled sale voids, stock restoration, and large-void Owner approval
- Negative-stock prevention for inventory movements
- Reorder quantity calculation
- Idempotent supplier-grouped purchase-order draft generation
- Dashboard closeout, trends, and void metrics
- AI local fallback and question validation
- MCP tool listing, read-only and proposal annotations, arguments, results,
  and error reporting
- Store Agent eval score gates for routing, answer language, grounding, and
  proposals
- Weekday forecast, store-day bucketing, and short-history fallback
- Agent action approval: run-once claims, stale minimum stock, rejection
- Invoice extraction requests and output validation, catalogue matching, cost
  change flags, one-transaction receipt, and duplicate invoices

GitHub Actions runs backend and frontend typechecking, linting, tests and
production builds. A final job validates Compose and builds both images.

## Project structure

```text
.
├── backend/
│   ├── prisma/                 PostgreSQL schema, migrations, demo seed
│   ├── eval/                   Agent eval cases and forecast backtest
│   └── src/
│       ├── auth/               JWT authentication
│       ├── products/           Product catalogue
│       ├── inventory/          Stock movements and expiration alerts
│       ├── sales/              Transactional POS workflow
│       ├── dashboard/          Store KPIs
│       ├── insights/           Store Agent, tools, forecast, expiry and minimum stock
│       ├── agent-actions/      Agent proposals and owner approval
│       ├── invoices/           Supplier invoice reading and receipt
│       └── mcp/                MCP server for the Store Agent tools
├── frontend/
│   ├── app/                    Next.js routes
│   ├── api/                    Typed API clients
│   ├── components/             UI and operational forms
│   └── lib/i18n/               EN / FR / ZH translations
├── docs/                       Architecture, AWS, demo, and roadmap
└── docker-compose.yml          Complete local stack
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Current project updates](docs/PROJECT_UPDATES.md)
- [AWS deployment](docs/DEPLOYMENT_AWS.md)
- [Interview demo script](docs/DEMO_SCRIPT.md)
- [Product roadmap](docs/ROADMAP.md)

## Current scope

The portfolio release is intentionally a single-store system. Draft purchase
orders and invoice-based receiving are implemented; sending orders to
suppliers and lot-level expiration remain future increments. Supplier lead time
is a fixed two days in the minimum stock review. Multi-store tenant isolation,
POS imports, and shelf vision are also documented future work rather than
claimed as finished functionality.

## Resume summary

**SmartDepanneur Agent — Agent-Assisted Retail Inventory and Replenishment Platform**

- Built a full-stack retail operations platform with Next.js, NestJS,
  PostgreSQL, Prisma, and Docker for sales, inventory, suppliers, expiration
  monitoring, audit trails, and role-based access.
- Implemented atomic stock reservation in PostgreSQL transactions to prevent
  concurrent checkouts and inventory adjustments from producing negative
  stock.
- Built a tool-using Store Agent (OpenAI Responses API, also served over MCP)
  whose purchase-order and minimum-stock proposals take effect only after the
  owner approves them.
- Replaced a flat seven-day average with a weekday-aware demand forecast; on a
  simulated backtest it cut lost sales 44.5% without raising inventory.
- Built a trilingual 133-question agent eval that found the fallback agent
  routed 42% of questions correctly and now gates the improved 90% in CI.
- Added supplier invoice reading with a vision model, catalogue matching, cost
  change flags, and reviewed one-transaction stock-in.
- Added audited sale void controls, dashboard closeout and trend analytics, and
  idempotent supplier-grouped purchase-order drafts.
- Automated TypeScript validation, linting, Jest tests, application builds, and
  Docker image validation through GitHub Actions.

## License

MIT
