import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  GetMarketplaceSummaryResponse,
  GetWalletSummaryResponse,
  ListMarketplaceCategoriesResponse,
  ListMarketplaceProductsQueryParams,
  ListMarketplaceProductsResponse,
} from "@workspace/api-zod";
import { db, marketplaceCategoriesTable, marketplaceDealsTable } from "@workspace/db";
import {
  categoryView,
  dealView,
  emptyWalletView,
  ensureMarketplaceSeeded,
  getOrCreateWallet,
  productView,
  queryProducts,
  walletView,
} from "../lib/marketplace";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};

router.get("/marketplace/summary", async (req, res): Promise<void> => {
  await ensureMarketplaceSeeded();
  const [categories, products, deals] = await Promise.all([
    db.select().from(marketplaceCategoriesTable),
    queryProducts({ limit: 6 }),
    db.select().from(marketplaceDealsTable),
  ]);
  const data = GetMarketplaceSummaryResponse.parse({
    categories: categories.map(categoryView),
    featuredProducts: products.map(({ product, categoryName }) =>
      productView(product, categoryName),
    ),
    deals: deals.map(dealView),
     wallet: emptyWalletView(),
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

router.get("/wallet/summary", requireAuth, async (req, res): Promise<void> => {
  await ensureMarketplaceSeeded();
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const wallet = await getOrCreateWallet(userId);
  if (!wallet) {
    res.status(503).json({ error: "Wallet summary is unavailable" });
    return;
  }
  res.json(GetWalletSummaryResponse.parse(walletView(wallet)));
});

export default router;