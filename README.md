# SmartDepanneur AI

AI-powered convenience store management platform inspired by real depanneur operations.

This project helps store owners and staff manage products, inventory, sales, suppliers, expiration checks, restocking workflows, and AI-generated business insights from one full-stack application.

## Why This Project

SmartDepanneur AI is designed around a realistic Canadian convenience store workflow instead of a generic demo app. It combines retail operations experience with a modern full-stack architecture, making it suitable for a portfolio, resume, or interview walkthrough.

The app is built for common depanneur scenarios:

- A store owner checks today's sales, profit, low-stock items, and expiring products.
- A cashier creates a sale and the system automatically deducts stock.
- Inventory staff records stock-in, adjustments, waste, and expiration checks.
- The AI assistant explains what to reorder and which products are performing poorly.

## Core Features

- Product inventory management for drinks, snacks, cigarettes, lottery items, OTC products, household goods, and other convenience store categories.
- Low-stock and reorder suggestions based on current stock, minimum stock thresholds, and recent sales activity.
- Expiration tracking for perishable products, helping staff identify expired and near-expiration items.
- POS-style sales workflow with cart items, subtotal, tax, total, estimated profit, payment method, and automatic stock updates.
- Dashboard for daily sales, revenue, low-stock products, active products, and top-selling products.
- AI insights panel that turns inventory and sales data into natural-language restocking suggestions, top-seller summaries, slow-mover analysis, and owner-friendly answers.
- Role-based access control for Admin, store owner, cashier, and inventory staff workflows.
- Multilingual UI for English, French, and Simplified Chinese.

## Main Modules

### Dashboard

- Today's sales count
- Today's revenue
- Estimated profit
- Low-stock product count
- Products expiring soon
- Top-selling products
- Low-stock and expiration tables

### Products

- Product name, barcode, SKU, category, supplier, unit
- Current stock and minimum stock
- Cost price and selling price
- Expiration tracking
- Active / inactive product status
- Audit history access

### Inventory

- Stock-in workflow for supplier deliveries
- Manual stock adjustment
- Waste / disposal recording
- Low-stock warning banner
- Expiration warning banner
- Inventory movement history

### Sales

- POS-style cart
- Product search and quantity selection
- Subtotal, Quebec tax, total, and estimated profit
- Cash, debit, credit, and other payment methods
- Automatic stock deduction after checkout

### AI Insights

- Ask natural-language questions such as:
  - `What should I restock today?`
  - `今天应该补什么货？`
  - `Que dois-je réapprovisionner aujourd’hui ?`
- Uses OpenAI Responses API when `OPENAI_API_KEY` is configured.
- Falls back to deterministic local analysis when no API key is available.
- Shows whether the answer came from `OpenAI API` or `Local fallback`.

### Admin / RBAC

- User management
- Role management
- Permission management
- Dictionary management
- Audit trail for important changes

## Tech Stack

Frontend:

- Next.js
- React
- TypeScript
- Ant Design
- Tailwind CSS
- Zustand

Backend:

- NestJS
- Node.js
- REST APIs
- JWT authentication
- RBAC
- OpenAI Responses API integration with local fallback

Database and Tools:

- PostgreSQL
- Prisma
- Docker
- GitHub

## Demo Accounts

After running the seed scripts, use these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Store Owner | `owner@smartdepanneur.local` | `123456` |
| Cashier | `cashier@smartdepanneur.local` | `123456` |
| Inventory Staff | `inventory@smartdepanneur.local` | `123456` |
| Admin | `admin@smartdepanneur.local` | `admin123` |

## Project Structure

- `backend`: NestJS API, Prisma schema, authentication, RBAC, products, categories, suppliers, inventory, sales, dashboard, and AI insight modules.
- `frontend`: Next.js dashboard UI, product management, sales flow, inventory tools, supplier/category pages, admin management, and AI insights panel.

## Quick Start

### 1. Start PostgreSQL

If you already have PostgreSQL running on `localhost:5432`, you can use it directly.

Or start PostgreSQL with Docker:

```bash
docker compose up -d postgres
```

The default database connection is:

```bash
postgresql://postgres:postgres@localhost:5432/depanneur
```

### 2. Configure Backend Environment

Create `backend/.env` based on `backend/.env.example`:

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Required values:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/depanneur"
PORT=3101
FRONTEND_URL="http://localhost:3100"
JWT_SECRET="change_me_for_local_demo"
```

### 3. Install Backend Dependencies

Install and start the backend:

```bash
cd backend
npm install
npx prisma migrate deploy
npm run seed
node prisma/seed-test-data.mjs
npm run start:dev
```

### 4. Install Frontend Dependencies

Install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Default ports:

- Backend: `3101`
- Frontend: `3100`

Open the app:

```bash
http://localhost:3100
```

## Local Development Scripts

From the repository root:

```bash
npm run dev:backend
npm run dev:frontend
```

Backend:

```bash
cd backend
npm run start:dev
npm run build
npm run seed
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
```

## AI Configuration

The AI Insights page supports English, French, and Simplified Chinese questions.

Set these values in `backend/.env` to enable real OpenAI API calls:

```bash
OPENAI_API_KEY="your_api_key_here"
OPENAI_MODEL="gpt-4o-mini"
```

If `OPENAI_API_KEY` is missing, SmartDepanneur AI still works with a local fallback that analyzes inventory and sales data deterministically. The AI response shows either `OpenAI API` or `Local fallback` in the UI.

## Production Deployment

Recommended deployment setup:

- Frontend: Vercel
- Backend: Railway, Render, or Fly.io
- Database: Supabase, Neon, Railway Postgres, or another managed PostgreSQL provider
- AI: OpenAI API key configured as a backend environment variable

Frontend environment variables:

```bash
NEXT_PUBLIC_API_URL="https://your-backend-domain.com"
```

Backend environment variables:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database"
PORT=3101
FRONTEND_URL="https://your-frontend-domain.com"
JWT_SECRET="replace_with_a_strong_secret"
NODE_ENV="production"
OPENAI_API_KEY="your_api_key_here"
OPENAI_MODEL="gpt-4o-mini"
```

Before publishing, run:

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run build
```

This repository also includes a GitHub Actions workflow at `.github/workflows/build.yml` that builds both the frontend and backend on pushes and pull requests to `main`.

## Demo UX

The login page includes one-click demo buttons for:

- Store Owner
- Cashier
- Inventory Staff

These accounts are created by `backend/prisma/seed-test-data.mjs` and are useful for interviews, portfolio demos, and quick production smoke tests.

## Multilingual Support

The UI supports:

- English
- French
- Simplified Chinese

The language switcher is available in the top navigation bar. Core portfolio demo pages are localized, including Dashboard, Products, Inventory, Sales, and AI Insights.

## Suggested Demo Flow

1. Log in as `owner@smartdepanneur.local`.
2. Open the Dashboard and review revenue, profit, low stock, and expiring products.
3. Go to Products and inspect stock, prices, suppliers, and expiration status.
4. Go to Inventory and record a stock-in or waste movement.
5. Go to Sales and create a sale from the cart.
6. Return to Dashboard to see the updated sales and stock data.
7. Open AI Insights and ask:
   - `What should I restock today?`
   - `今天应该补什么货？`
   - `Que dois-je réapprovisionner aujourd’hui ?`

## Notes

- This repository includes some legacy recruitment/admin modules from an earlier scaffold. The main portfolio experience is the SmartDepanneur store management workflow.
- Demo data is generated by `backend/prisma/seed-test-data.mjs`.
- Uploaded files, local `.env` files, dependencies, and build outputs are intentionally ignored by git.

## Resume Summary

**SmartDepanneur AI - AI-Powered Convenience Store Management Platform**

- Built a full-stack convenience store management platform inspired by real depanneur operations, supporting product inventory, sales tracking, expiration monitoring, restocking workflows, and AI-generated business insights.
- Developed responsive dashboards with Next.js, React, TypeScript, Ant Design, Tailwind CSS, and Zustand to display daily sales, estimated profit, low-stock products, top-selling items, and products approaching expiration.
- Implemented backend modules with NestJS, PostgreSQL, Prisma, JWT authentication, and RBAC for products, categories, suppliers, users, sales, stock movements, and audit records.
- Integrated an AI assistant that analyzes inventory and sales data to generate natural-language restocking suggestions, product performance summaries, and operational recommendations for store owners.
- Automated stock updates after sales transactions and flagged low-stock or near-expiration products, reducing manual tracking and helping store staff make faster restocking decisions.
