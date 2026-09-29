# Free browser demo

The public preview uses the existing Next.js store screens and a browser-only simulation. It is a portfolio preview, not a hosted NestJS/PostgreSQL installation or a production POS.

## Included

- Owner and cashier demo buttons; no registration or real credentials required.
- Sixteen fictional products, categories, fictional suppliers and seven days of sample sales.
- Product/category/supplier editing, sales and voids, stock movements, dashboards, expiry alerts, rule-based insights and purchase-order drafts.
- English, French and Chinese interface, persistent demo banner and reset button.
- Data stored under `smartdepanneur-preview-v1` in the visitor's local browser storage. If storage is unavailable, changes last only for the tab's lifetime.
- No backend network calls, payment processing, outgoing orders, file uploads or external AI calls. The insights response explicitly identifies its simulated rule-based nature.

Do not enter real customer, employee or business data. Each browser has its own demo; it is not synchronized across devices. Demo roles illustrate the interface and are not a security boundary. The preview deliberately excludes administration and legacy recruitment workflows. Its sales tax is an illustrative default, not product-specific tax handling. Inventory uses the same demonstration-level single-product stock concept as the app.

## Build and publish

From `frontend`, run `npm ci` and `npm run demo:build` using Node 22. The generated `out` directory is deployable to GitHub Pages. `NEXT_PUBLIC_BASE_PATH` defaults to `/smartDepanneur`; set it to an empty string for hosting at a domain root.

The `Deploy free demo preview` workflow builds pushes to `codex/free-demo-preview` and deploys via the `github-pages` environment. Enable GitHub Pages with **GitHub Actions** as the build source and allow this specific branch in the environment's deployment branch rules if required. No paid account, secret, database or API key is needed. The default URL is https://yujiemichael.github.io/smartDepanneur/.

The normal `npm run build` still produces the server application. `NEXT_PUBLIC_DEMO_MODE=true` is applied only by the demo build command; the backend is not deployed. The original backend dependency and production-readiness issues remain separate work.

Preview pages include `noindex` metadata. To remove the public preview, disable GitHub Pages in repository settings; the source remains available in the preview branch.
