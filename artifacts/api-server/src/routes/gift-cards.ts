import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
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

const router: IRouter = Router();
const money = (v: string | number | null | undefined) => Number(v ?? 0);

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};

export function giftCardView(card: GiftCard) {
  return {
    id: card.id,
    brandId: card.brandId,
    faceValue: money(card.faceValue),
    price: money(card.price),
    stock: card.stock,
    active: card.active,
  };
}

export function brandView(brand: GiftCardBrand, cards: GiftCard[]) {
  return {
    id: brand.id,
    name: brand.name,
    logoUrl: brand.logoUrl,
    description: brand.description,
    active: brand.active,
    cards: cards.map(giftCardView),
  };
}

export function giftCardOrderView(order: GiftCardOrder) {
  return {
    id: order.id,
    cardId: order.cardId,
    brandName: order.brandName,
    faceValue: money(order.faceValue),
    pricePaid: money(order.pricePaid),
    paymentMethod: order.paymentMethod,
    paymentRef: order.paymentRef,
    cardCode: order.cardCode,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}

const brandSeed: { brand: Omit<GiftCardBrand, "createdAt">; cards: { faceValue: string; price: string; stock: number }[] }[] = [
  {
    brand: {
      id: "gcb-daraz",
      name: "Daraz",
      logoUrl: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=400&q=80",
      description: "Shop everything on Bangladesh's biggest marketplace.",
      active: true,
    },
    cards: [
      { faceValue: "1000", price: "930", stock: 50 },
      { faceValue: "2000", price: "1840", stock: 30 },
    ],
  },
  {
    brand: {
      id: "gcb-foodpanda",
      name: "foodpanda",
      logoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
      description: "Food delivery credit for restaurants across the country.",
      active: true,
    },
    cards: [
      { faceValue: "500", price: "460", stock: 80 },
      { faceValue: "1000", price: "910", stock: 40 },
    ],
  },
  {
    brand: {
      id: "gcb-pathao",
      name: "Pathao",
      logoUrl: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80",
      description: "Rides, courier, and food credit in one wallet.",
      active: true,
    },
    cards: [{ faceValue: "500", price: "465", stock: 100 }],
  },
];

let seedPromise: Promise<void> | undefined;
export function ensureGiftCardsSeeded(): Promise<void> {
  seedPromise ??= (async () => {
    await db
      .insert(giftCardBrandsTable)
      .values(brandSeed.map((s) => s.brand))
      .onConflictDoNothing();
    await db
      .insert(giftCardsTable)
      .values(
        brandSeed.flatMap((s) =>
          s.cards.map((c, i) => ({
            id: `${s.brand.id}-card-${i}`,
            brandId: s.brand.id,
            faceValue: c.faceValue,
            price: c.price,
            stock: c.stock,
          })),
        ),
      )
      .onConflictDoNothing();
  })();
  return seedPromise;
}

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
