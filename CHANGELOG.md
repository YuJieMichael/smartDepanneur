# Changelog

## v1.2.0 - Multilingual Store Agent

- Replaced the one-shot AI context prompt with a read-only Responses API
  function-calling loop.
- Added reorder, top-seller, slow-mover, and store-summary Agent tools.
- Added an offline local Agent that uses the same business operations.
- Made the selected `en`, `fr`, or `zh` UI locale authoritative for answers.
- Reduced Ask suggestions from three mixed languages to the selected language.
- Added visible tool traces and multilingual Agent tests.

## v1.1.0 - Portfolio Hardening

- Prevented concurrent sales and inventory adjustments from producing negative stock.
- Added validated runtime configuration and removed the fallback JWT signing secret.
- Separated production startup, database migrations, and demo data seeding.
- Added backend tests for health, configuration, sales, inventory, and AI insights.
- Added complete frontend/backend Docker images and a full local Compose stack.
- Expanded GitHub Actions to run typechecking, linting, tests, builds, and container validation.
- Added Dependabot and architecture, AWS deployment, roadmap, and interview demo documentation.
- Added bounded AI questions, OpenAI timeouts, and logged fallback reasons.

## v1.0.0 - SmartDepanneur AI Initial Release

Initial portfolio-ready release of SmartDepanneur AI.

- Full-stack convenience store management workflow with Next.js, NestJS, PostgreSQL, and Prisma.
- Product inventory, categories, suppliers, stock movements, sales, dashboard, and audit records.
- AI Insights with OpenAI API support and deterministic local fallback.
- English, French, and Simplified Chinese UI support for the core store workflow.
- Demo login accounts for Store Owner, Cashier, and Inventory Staff.
- Production deployment notes and GitHub Actions build checks.
