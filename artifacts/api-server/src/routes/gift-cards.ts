import { Router, type IRouter } from "express";
import {
  ListGiftCardBrandsResponse,
  ListMyGiftCardOrdersResponse,
  PurchaseGiftCardBody,
  PurchaseGiftCardParams,
  PurchaseGiftCardResponse,
} from "@workspace/api-zod";
import { and, eq, gt, sql } from "drizzle-orm";
import {
  db,
  giftCardBrandsTable,
  giftCardsTable,
  giftCardOrdersTable,
  type GiftCard,
  type GiftCardBrand,
  type GiftCardOrder,
} from "@workspace/db";
import { recordedPaymentService } from "../lib/payments";
import { requireAuth } from "../middleware/auth";
import { money } from "../lib/money";
import {
  giftCardView,
  brandView,
  giftCardOrderView,
  ensureGiftCardsSeeded,
} from "../domains/gift-cards/gift-card.service";

const router: IRouter = Router();

router.get("/gift-cards", async (_req, res): Promise<void> => {
  await ensureGiftCardsSeeded();
  const brands = await db
    .select()
    .from(giftCardBrandsTable)
    .where(eq(giftCardBrandsTable.active, true));
  const cards = await db.select().from(giftCardsTable).where(eq(giftCardsTable.active, true));
  const view = brands
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((brand) =>
      brandView(
        brand,
        cards.filter((c) => c.brandId === brand.id && c.stock > 0),
      ),
    );
  res.json(ListGiftCardBrandsResponse.parse(view));
});

router.post("/gift-cards/:id/purchase", requireAuth, async (req, res): Promise<void> => {
  await ensureGiftCardsSeeded();
  const params = PurchaseGiftCardParams.safeParse(req.params);
  const parsed = PurchaseGiftCardBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid purchase request" });
    return;
  }

  const [card] = await db
    .select()
    .from(giftCardsTable)
    .where(eq(giftCardsTable.id, params.data.id))
    .limit(1);
  if (!card) {
    res.status(404).json({ error: "Gift card not found" });
    return;
  }
  const [brand] = await db
    .select()
    .from(giftCardBrandsTable)
    .where(eq(giftCardBrandsTable.id, card.brandId))
    .limit(1);
  if (!brand || !brand.active || !card.active) {
    res.status(409).json({ error: "This gift card is currently unavailable" });
    return;
  }

  // Atomic stock decrement guards against oversell under concurrent purchases.
  const [claimed] = await db
    .update(giftCardsTable)
    .set({ stock: sql`${giftCardsTable.stock} - 1` })
    .where(and(eq(giftCardsTable.id, card.id), gt(giftCardsTable.stock, 0)))
    .returning();
  if (!claimed) {
    res.status(409).json({ error: "This gift card is out of stock" });
    return;
  }

  try {
    const charge = await recordedPaymentService.charge({
      customerId: res.locals.userId as string,
      amount: money(card.price),
      method: parsed.data.paymentMethod,
      purpose: `gift-card:${card.id}`,
    });

    const cardCode = `BDGC-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const [order] = await db
      .insert(giftCardOrdersTable)
      .values({
        id: `gcorder_${crypto.randomUUID()}`,
        cardId: card.id,
        customerId: res.locals.userId as string,
        brandName: brand.name,
        faceValue: card.faceValue,
        pricePaid: card.price,
        paymentMethod: charge.method,
        paymentRef: charge.reference,
        cardCode,
        status: "delivered",
      })
      .returning();

    res.status(201).json(PurchaseGiftCardResponse.parse(giftCardOrderView(order)));
  } catch (error) {
    // Return the reserved unit if payment/delivery failed.
    await db
      .update(giftCardsTable)
      .set({ stock: sql`${giftCardsTable.stock} + 1` })
      .where(eq(giftCardsTable.id, card.id));
    throw error;
  }
});

router.get("/gift-cards/orders", requireAuth, async (_req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(giftCardOrdersTable)
    .where(eq(giftCardOrdersTable.customerId, res.locals.userId as string));
  res.json(
    ListMyGiftCardOrdersResponse.parse(
      orders
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(giftCardOrderView),
    ),
  );
});

export default router;
