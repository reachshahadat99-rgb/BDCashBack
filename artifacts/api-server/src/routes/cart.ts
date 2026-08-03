import { Router, type IRouter } from "express";
import {
  AddCartItemBody,
  UpdateCartItemBody,
  GetCartResponse,
  AddCartItemResponse,
  UpdateCartItemResponse,
} from "@workspace/api-zod";
import {
  getCartWithItems,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../lib/orders";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /cart
router.get("/cart", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const cart = await getCartWithItems(userId);
  res.json(GetCartResponse.parse(cart));
});

// POST /cart/items
router.post("/cart/items", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const parsed = AddCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, quantity } = parsed.data;
  if (quantity < 1) {
    res.status(400).json({ error: "Quantity must be at least 1" });
    return;
  }

  const result = await addToCart(userId, productId, quantity);
  if ("error" in result) {
    const status = result.error === "Product not found or unavailable" ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }

  res.status(201).json(AddCartItemResponse.parse(result.cart));
});

// PATCH /cart/items/:itemId
router.patch("/cart/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const itemId = String(req.params.itemId);

  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await updateCartItem(userId, itemId, parsed.data.quantity);
  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.json(UpdateCartItemResponse.parse(result.cart));
});

// DELETE /cart/items/:itemId
router.delete("/cart/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const itemId = String(req.params.itemId);

  const result = await removeCartItem(userId, itemId);
  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.status(204).end();
});

// DELETE /cart
router.delete("/cart", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  await clearCart(userId);
  res.status(204).end();
});

export default router;
