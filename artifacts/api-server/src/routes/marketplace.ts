import { Router, type IRouter } from "express";
import {
  GetMarketplaceSummaryResponse,
  GetWalletSummaryResponse,
  ListMarketplaceCategoriesResponse,
  ListMarketplaceProductsQueryParams,
  ListMarketplaceProductsResponse,
} from "@workspace/api-zod";
import { db, marketplaceCategoriesTable, marketplaceDealsTable, walletSnapshotsTable } from "@workspace/db";
import {
  categoryView,
  dealView,
  ensureMarketplaceSeeded,
  productView,
  queryProducts,
  walletView,
} from "../lib/marketplace";

const router: IRouter = Router();

router.get("/marketplace/summary", async (req, res): Promise<void> => {
  await ensureMarketplaceSeeded();
  const [categories, products, deals, walletRows] = await Promise.all([
    db.select().from(marketplaceCategoriesTable),
    queryProducts({ limit: 6 }),
    db.select().from(marketplaceDealsTable),
    db.select().from(walletSnapshotsTable).limit(1),
  ]);
  const wallet = walletRows[0];
  if (!wallet) {
    res.status(503).json({ error: "Wallet summary is unavailable" });
    return;
  }
  const data = GetMarketplaceSummaryResponse.parse({
    categories: categories.map(categoryView),
    featuredProducts: products.map(({ product, categoryName }) =>
      productView(product, categoryName),
    ),
    deals: deals.map(dealView),
    wallet: walletView(wallet),
  });
  req.log.info({ productCount: products.length }, "Loaded marketplace summary");
  res.json(data);
});

router.get("/marketplace/categories", async (_req, res): Promise<void> => {
  await ensureMarketplaceSeeded();
  const categories = await db.select().from(marketplaceCategoriesTable);
  res.json(ListMarketplaceCategoriesResponse.parse(categories.map(categoryView)));
});

router.get("/marketplace/products", async (req, res): Promise<void> => {
  const parsed = ListMarketplaceProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureMarketplaceSeeded();
  const products = await queryProducts(parsed.data);
  res.json(
    ListMarketplaceProductsResponse.parse(
      products.map(({ product, categoryName }) => productView(product, categoryName)),
    ),
  );
});

router.get("/wallet/summary", async (_req, res): Promise<void> => {
  await ensureMarketplaceSeeded();
  const [wallet] = await db.select().from(walletSnapshotsTable).limit(1);
  if (!wallet) {
    res.status(503).json({ error: "Wallet summary is unavailable" });
    return;
  }
  res.json(GetWalletSummaryResponse.parse(walletView(wallet)));
});

export default router;