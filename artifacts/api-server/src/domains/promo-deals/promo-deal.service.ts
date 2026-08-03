/**
 * Promo Deals domain — view helpers and query functions.
 *
 * Extracted from routes/promo-deals.ts to break the inverted dependency
 * where admin imported service helpers from a peer route file.
 */

import { eq } from "drizzle-orm";
import { db, promoDealsTable, merchantStoresTable, type PromoDeal } from "@workspace/db";
import { money } from "../../lib/money";

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function promoDealView(deal: PromoDeal, storeName: string) {
  return {
    id: deal.id,
    storeId: deal.storeId,
    storeName,
    title: deal.title,
    description: deal.description,
    imageUrl: deal.imageUrl,
    discountPercent: money(deal.discountPercent),
    startsAt: deal.startsAt.toISOString(),
    endsAt: deal.endsAt.toISOString(),
    status: deal.status,
    featured: deal.featured,
    createdAt: deal.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listDealsWithStore(where?: ReturnType<typeof eq>) {
  const rows = await db
    .select({ deal: promoDealsTable, storeName: merchantStoresTable.name })
    .from(promoDealsTable)
    .innerJoin(merchantStoresTable, eq(promoDealsTable.storeId, merchantStoresTable.id))
    .where(where);
  return rows
    .sort((a, b) => b.deal.createdAt.getTime() - a.deal.createdAt.getTime())
    .map((r) => promoDealView(r.deal, r.storeName));
}
