/**
 * Gift Cards domain — view helpers, seed data, seeding function.
 *
 * Extracted from routes/gift-cards.ts to break the inverted dependency
 * where admin imported service helpers from a peer route file.
 */

import {
  db,
  giftCardBrandsTable,
  giftCardsTable,
  type GiftCard,
  type GiftCardBrand,
  type GiftCardOrder,
} from "@workspace/db";
import { money } from "../../lib/money";

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const brandSeed: {
  brand: Omit<GiftCardBrand, "createdAt">;
  cards: { faceValue: string; price: string; stock: number }[];
}[] = [
  {
    brand: {
      id: "gcb-daraz",
      name: "Daraz",
      logoUrl:
        "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=400&q=80",
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
      logoUrl:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
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
      logoUrl:
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80",
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
