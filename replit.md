# BDCashBack

BDCashBack is a Bangladesh-focused cashback marketplace where customers discover deals, earn rewards, and manage their wallet.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bdcashback run dev` — run the customer marketplace
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/` — Drizzle database schema
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/bdcashback/src/` — customer marketplace UI

## Architecture decisions

- Marketplace reads use the shared Express API and generated OpenAPI clients rather than frontend-only fixtures.
- The first customer-facing module uses a small seeded catalog and wallet snapshot so the product is useful immediately while remaining easy to replace with authenticated customer data.
- Monetary and percentage values are stored as PostgreSQL numeric fields and converted at the API boundary for stable JSON contracts.

## Product

The current milestone provides a responsive customer marketplace home, product discovery with search and category filters, a wallet summary, deal highlights, and a polished sign-in entry screen.

## User preferences

No additional user preferences recorded.

## Gotchas

- Artifact web services must honor the workflow-provided `PORT` and `BASE_PATH`; the BDCashBack Vite config is intentionally strict about both.
- Regenerate API clients after every OpenAPI change with `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
