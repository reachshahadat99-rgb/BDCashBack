import { Router, type IRouter } from "express";
import {
  CreateMerchantDealBody,
  CreateMerchantDealResponse,
  ListMerchantDealsResponse,
  ListPromoDealsQueryParams,
  ListPromoDealsResponse,
  UpdateMerchantDealBody,
  UpdateMerchantDealParams,
  UpdateMerchantDealResponse,
} from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import { db, promoDealsTable, merchantStoresTable, type PromoDeal } from "@workspace/db";
import { getMerchantStore } from "../lib/merchant";
import { requireAuth } from "../middleware/auth";
import { promoDealView, listDealsWithStore } from "../domains/promo-deals/promo-deal.service";

const router: IRouter = Router();

function validateDealDates(startsAt: Date, endsAt: Date): string | undefined {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "Valid start and end dates are required";
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return "End date must be after the start date";
  }
  return undefined;
}

router.get("/promo-deals", async (req, res): Promise<void> => {
  const query = ListPromoDealsQueryParams.safeParse(req.query);
  const featuredOnly = query.success && query.data.featured === true;
  const now = Date.now();
  const all = await listDealsWithStore(eq(promoDealsTable.status, "approved"));
  const live = all.filter(
    (d) =>
      new Date(d.startsAt).getTime() <= now &&
      new Date(d.endsAt).getTime() > now &&
      (!featuredOnly || d.featured),
  );
  res.json(ListPromoDealsResponse.parse(live));
});

router.get("/merchant/deals", requireAuth, async (_req, res): Promise<void> => {
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.json(ListMerchantDealsResponse.parse([]));
    return;
  }
  res.json(
    ListMerchantDealsResponse.parse(
      await listDealsWithStore(eq(promoDealsTable.storeId, store.id)),
    ),
  );
});

router.post("/merchant/deals", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMerchantDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid deal" });
    return;
  }
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  const dateError = validateDealDates(startsAt, endsAt);
  if (dateError) {
    res.status(400).json({ error: dateError });
    return;
  }
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.status(404).json({ error: "Create your store before adding deals" });
    return;
  }

  const [deal] = await db
    .insert(promoDealsTable)
    .values({
      id: `pdeal_${crypto.randomUUID()}`,
      storeId: store.id,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ?? "",
      imageUrl: parsed.data.imageUrl?.trim() ?? "",
      discountPercent: String(parsed.data.discountPercent),
      startsAt,
      endsAt,
      status: "pending",
    })
    .returning();

  res.status(201).json(CreateMerchantDealResponse.parse(promoDealView(deal, store.name)));
});

router.patch("/merchant/deals/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateMerchantDealParams.safeParse(req.params);
  const parsed = UpdateMerchantDealBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid deal update" });
    return;
  }
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(promoDealsTable)
    .where(and(eq(promoDealsTable.id, params.data.id), eq(promoDealsTable.storeId, store.id)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : existing.startsAt;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : existing.endsAt;
  const dateError = validateDealDates(startsAt, endsAt);
  if (dateError) {
    res.status(400).json({ error: dateError });
    return;
  }

  const contentChanged =
    parsed.data.title !== undefined ||
    parsed.data.discountPercent !== undefined ||
    parsed.data.startsAt !== undefined ||
    parsed.data.endsAt !== undefined;

  const [updated] = await db
    .update(promoDealsTable)
    .set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description.trim() }
        : {}),
      ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl.trim() } : {}),
      ...(parsed.data.discountPercent !== undefined
        ? { discountPercent: String(parsed.data.discountPercent) }
        : {}),
      ...(parsed.data.startsAt !== undefined ? { startsAt } : {}),
      ...(parsed.data.endsAt !== undefined ? { endsAt } : {}),
      // Material edits reset the deal to pending so admin re-approves it.
      ...(contentChanged && existing.status === "approved"
        ? { status: "pending", featured: false }
        : {}),
    })
    .where(eq(promoDealsTable.id, existing.id))
    .returning();

  res.json(UpdateMerchantDealResponse.parse(promoDealView(updated, store.name)));
});

export default router;
