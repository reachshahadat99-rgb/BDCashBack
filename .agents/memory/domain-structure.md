---
name: Codebase domain structure
description: Post-refactor layout of api-server and bdcashback; rules for where code lives.
---

## API server (artifacts/api-server/src/)

**Domain services** — business logic, views, DB queries live here:
- `domains/wallet/wallet.service.ts`
- `domains/orders/orders.service.ts`
- `domains/coupons/coupon.service.ts`
- `domains/promo-deals/promo-deal.service.ts`
- `domains/gift-cards/gift-card.service.ts`
- `domains/group-buy/group-buy.service.ts` (seed data + executeJoin + campaignProgress + campaignView)
- `domains/group-buy/group-buy-processor.ts` (settlement scheduler)

**Routes** — thin HTTP handlers only (parse → call service → respond). No service logic inline.

**Canonical shared lib/**:
- `lib/money.ts` — `money()` + `round2()`
- `lib/coupon-validator.ts` — `validateCouponEligibility()` single source
- `lib/orders.ts` — re-export barrel (compat)
- `lib/group-buy-processor.ts` — re-export barrel (compat)

**Middleware**:
- `middleware/auth.ts` — `requireAuth`, re-exports `requireAdmin`/`isAdmin`
- `middleware/clerkProxy.ts` — Clerk FAPI proxy (canonical)
- `middlewares/clerkProxyMiddleware.ts` — re-export barrel (compat)

**Key rule**: admin route (`routes/admin.ts`) imports ONLY from domain services, never from peer route files. Importing from `./coupons`, `./promo-deals`, `./group-buy`, `./gift-cards` in admin.ts is the anti-pattern this refactor fixed.

## Frontend (artifacts/bdcashback/src/)

**Shared utils** (`lib/utils.ts`): `cn`, `formatCurrency`, `formatNumber`, `fmtDate`

**Admin tab components** extracted to `components/admin/`:
- `admin-helpers.tsx` — `statusBadge` shared helper
- One file per tab: MerchantsTab, CouponsTab, DealsTab, GroupBuysTab, GiftCardsTab, FeeRulesTab, WithdrawalsTab, AdminOrdersTab, CashbackQueueTab, AuditLogsTab

**Why:** Admin.tsx was 887 lines with 10 inline tab components. Now ~100 lines (auth shell + tab wiring).
