import { Router, type IRouter } from "express";
import {
  CheckoutBody,
  CheckoutResponse,
  ListOrdersResponse,
  GetOrderResponse,
  CancelOrderResponse,
} from "@workspace/api-zod";
import {
  checkout,
  listOrders,
  getOrderDetail,
  cancelOrder,
} from "../lib/orders";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// POST /checkout
router.post("/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const body = CheckoutBody.safeParse(req.body ?? {});
  const couponCode = body.success ? (body.data.couponCode ?? undefined) : undefined;
  const deliveryAddress = body.success ? (body.data.deliveryAddress ?? undefined) : undefined;

  try {
    const result = await checkout(userId, couponCode, deliveryAddress);
    res.status(201).json(CheckoutResponse.parse(result.order));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    res.status(400).json({ error: msg });
  }
});

// GET /orders
router.get("/orders", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const orders = await listOrders(userId);
  res.json(ListOrdersResponse.parse(orders));
});

// GET /orders/:id
router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const id = String(req.params.id);

  const order = await getOrderDetail(userId, id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(GetOrderResponse.parse(order));
});

// POST /orders/:id/cancel
router.post("/orders/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const id = String(req.params.id);

  try {
    const result = await cancelOrder(userId, id);
    res.json(CancelOrderResponse.parse(result.order));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not cancel order";
    const status = msg === "ORDER_NOT_FOUND" ? 404 : 400;
    const body = status === 404 ? "Order not found" : msg;
    res.status(status).json({ error: body });
  }
});

export default router;
