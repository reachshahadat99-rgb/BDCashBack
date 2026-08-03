import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateMerchantProductBody,
  CreateMerchantProductResponse,
  CreateMerchantStoreBody,
  CreateMerchantStoreResponse,
  DeleteMerchantProductParams,
  GetMerchantStoreResponse,
  GetMerchantSummaryResponse,
  ListMerchantOrdersResponse,
  ListMerchantProductsResponse,
  UpdateMerchantOrderStatusBody,
  UpdateMerchantOrderStatusParams,
  UpdateMerchantOrderStatusResponse,
  UpdateMerchantProductBody,
  UpdateMerchantProductParams,
  UpdateMerchantProductResponse,
} from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  marketplaceCategoriesTable,
  merchantProductsTable,
  merchantStoresTable,
} from "@workspace/db";
import {
  getMerchantStore,
  getMerchantSummary,
  getOwnedProduct,
  listMerchantOrders,
  listOwnedProducts,
  merchantProductView,
  slugify,
  storeView,
  updateMerchantOrderStatus,
} from "../lib/merchant";

const router: IRouter = Router();
const money = (value: string | number | null | undefined) => Number(value ?? 0);

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};

function ownerId(res: Parameters<RequestHandler>[1]) {
  return res.locals.userId as string;
}

function validateProductValues(input: {
  name?: string;
  brand?: string;
  price?: number;
  originalPrice?: number;
  cashbackPercent?: number;
  stock?: number;
  imageUrl?: string;
}) {
  if (input.name !== undefined && !input.name.trim()) return "Product name is required";
  if (input.brand !== undefined && !input.brand.trim()) return "Brand is required";
  if (input.price !== undefined && input.price <= 0) return "Price must be greater than zero";
  if (
    input.originalPrice !== undefined &&
    input.price !== undefined &&
    input.originalPrice < input.price
  ) {
    return "Original price cannot be lower than sale price";
  }
  if (
    input.cashbackPercent !== undefined &&
    (input.cashbackPercent < 0 || input.cashbackPercent > 100)
  ) {
    return "Cashback must be between 0 and 100 percent";
  }
  if (
    input.stock !== undefined &&
    (!Number.isInteger(input.stock) || input.stock < 0)
  ) {
    return "Stock must be a whole number of zero or more";
  }
  if (input.imageUrl !== undefined && input.imageUrl.trim()) {
    try {
      new URL(input.imageUrl);
    } catch {
      return "Image URL must be a valid URL";
    }
  }
  return undefined;
}

router.get("/merchant/summary", requireAuth, async (_req, res): Promise<void> => {
  const data = GetMerchantSummaryResponse.parse(await getMerchantSummary(ownerId(res)));
  res.json(data);
});

router.get("/merchant/store", requireAuth, async (_req, res): Promise<void> => {
  const store = await getMerchantStore(ownerId(res));
  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }
  res.json(GetMerchantStoreResponse.parse(storeView(store)));
});

router.post("/merchant/store", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMerchantStoreBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "A store name is required" });
    return;
  }

  const current = await getMerchantStore(ownerId(res));
  if (current) {
    res.status(409).json({ error: "You already have a store" });
    return;
  }

  const slug = slugify(parsed.data.name);
  if (!slug) {
    res.status(400).json({ error: "Store name must contain letters or numbers" });
    return;
  }

  const [store] = await db
    .insert(merchantStoresTable)
    .values({
      id: `store_${crypto.randomUUID()}`,
      ownerId: ownerId(res),
      name: parsed.data.name.trim(),
      slug,
      description: parsed.data.description?.trim() ?? "",
      logoUrl: parsed.data.logoUrl?.trim() ?? "",
    })
    .returning();

  res.status(201).json(
    CreateMerchantStoreResponse.parse(storeView(store)),
  );
});

router.get("/merchant/products", requireAuth, async (_req, res): Promise<void> => {
  const { products } = await listOwnedProducts(ownerId(res));
  res.json(ListMerchantProductsResponse.parse(products));
});

router.post("/merchant/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMerchantProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const validationError = validateProductValues(parsed.data);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const store = await getMerchantStore(ownerId(res));
  if (!store) {
    res.status(404).json({ error: "Create your store before adding products" });
    return;
  }
  const [category] = await db
    .select()
    .from(marketplaceCategoriesTable)
    .where(eq(marketplaceCategoriesTable.id, parsed.data.categoryId))
    .limit(1);
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const [product] = await db
    .insert(merchantProductsTable)
    .values({
      id: `product_${crypto.randomUUID()}`,
      storeId: store.id,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? "",
      brand: parsed.data.brand.trim(),
      price: String(parsed.data.price),
      originalPrice: String(parsed.data.originalPrice),
      cashbackPercent: String(parsed.data.cashbackPercent),
      imageUrl: parsed.data.imageUrl.trim(),
      stock: parsed.data.stock,
      available: parsed.data.available && parsed.data.stock > 0,
      status: "published",
    })
    .returning();

  res.status(201).json(
    CreateMerchantProductResponse.parse(
      merchantProductView(product, category.name),
    ),
  );
});

router.patch("/merchant/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateMerchantProductParams.safeParse(req.params);
  const parsed = UpdateMerchantProductBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid product update" });
    return;
  }

  const existing = await getOwnedProduct(ownerId(res), params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const merged = {
    name: parsed.data.name ?? existing.product.name,
    brand: parsed.data.brand ?? existing.product.brand,
    price: parsed.data.price ?? money(existing.product.price),
    originalPrice:
      parsed.data.originalPrice ?? money(existing.product.originalPrice),
    cashbackPercent:
      parsed.data.cashbackPercent ?? money(existing.product.cashbackPercent),
    stock: parsed.data.stock ?? existing.product.stock,
    imageUrl: parsed.data.imageUrl ?? existing.product.imageUrl,
  };
  const validationError = validateProductValues(merged);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  let categoryName = existing.categoryName;
  if (parsed.data.categoryId && parsed.data.categoryId !== existing.product.categoryId) {
    const [category] = await db
      .select()
      .from(marketplaceCategoriesTable)
      .where(eq(marketplaceCategoriesTable.id, parsed.data.categoryId))
      .limit(1);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    categoryName = category.name;
  }

  const [product] = await db
    .update(merchantProductsTable)
    .set({
      ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description.trim() }
        : {}),
      ...(parsed.data.brand !== undefined ? { brand: parsed.data.brand.trim() } : {}),
      ...(parsed.data.price !== undefined ? { price: String(parsed.data.price) } : {}),
      ...(parsed.data.originalPrice !== undefined
        ? { originalPrice: String(parsed.data.originalPrice) }
        : {}),
      ...(parsed.data.cashbackPercent !== undefined
        ? { cashbackPercent: String(parsed.data.cashbackPercent) }
        : {}),
      ...(parsed.data.imageUrl !== undefined
        ? { imageUrl: parsed.data.imageUrl.trim() }
        : {}),
      ...(parsed.data.stock !== undefined ? { stock: parsed.data.stock } : {}),
      ...(parsed.data.available !== undefined
        ? { available: parsed.data.available && merged.stock > 0 }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(merchantProductsTable.id, params.data.id))
    .returning();

  res.json(
    UpdateMerchantProductResponse.parse(
      merchantProductView(product, categoryName),
    ),
  );
});

router.delete("/merchant/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteMerchantProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const existing = await getOwnedProduct(ownerId(res), params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await db
    .update(merchantProductsTable)
    .set({ status: "archived", available: false, updatedAt: new Date() })
    .where(
      and(
        eq(merchantProductsTable.id, params.data.id),
        eq(merchantProductsTable.storeId, existing.product.storeId),
      ),
    );
  res.sendStatus(204);
});

router.get("/merchant/orders", requireAuth, async (_req, res): Promise<void> => {
  res.json(ListMerchantOrdersResponse.parse(await listMerchantOrders(ownerId(res))));
});

// PATCH /merchant/orders/:id/status
// Advance fulfillment: pending → processing → shipped → delivered
// Marking delivered triggers automatic customer-order delivery + cashback release
router.patch("/merchant/orders/:id/status", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateMerchantOrderStatusParams.safeParse(req.params);
  const body = UpdateMerchantOrderStatusBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  try {
    const updated = await updateMerchantOrderStatus(
      ownerId(res),
      params.data.id,
      body.data.status as "processing" | "shipped" | "delivered",
    );
    res.json(UpdateMerchantOrderStatusResponse.parse(updated));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Status update failed";
    if (msg === "ORDER_NOT_FOUND" || msg === "STORE_NOT_FOUND") {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

export default router;