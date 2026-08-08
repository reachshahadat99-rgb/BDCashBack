/**
 * Route-level integration tests for phone validation in POST /api/checkout.
 *
 * Strategy: mount the real orders router on a minimal Express app, with only
 * @workspace/db and the orders service mocked (to avoid DB connections in CI).
 * Auth is short-circuited by mocking @clerk/express.getAuth to always return
 * a user id.
 *
 * Phone validation fires BEFORE the checkout service is called, so invalid
 * phone tests never reach the mock at all — they return 422 immediately.
 * Valid phone tests reach the mock, which returns a fake order → 201.
 */

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock handles ─────────────────────────────────────────────────────
// vi.hoisted runs before module-level imports, making these available inside
// vi.mock() factory callbacks.

const { mockCheckout } = vi.hoisted(() => ({
  mockCheckout: vi.fn(),
}));

// ─── Module mocks (hoisted by vitest before any module evaluates) ─────────────

// Prevent "DATABASE_URL must be set" throw that fires at import time.
vi.mock("@workspace/db", () => ({
  db: {},
  pool: {},
  customerCartsTable: {},
  customerCartItemsTable: {},
  customerOrdersTable: {},
  customerOrderItemsTable: {},
  merchantOrdersTable: {},
  merchantProductsTable: {},
  merchantStoresTable: {},
  couponsTable: {},
  walletTransactionsTable: {},
  walletSnapshotsTable: {},
  adminUsersTable: {},
  CASHBACK_RETURN_WINDOW_DAYS: 7,
}));

// Fake Clerk so requireAuth always succeeds and injects a userId.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: "test-user-id" }),
}));

// Mock the orders service barrel so no real DB calls are made.
vi.mock("../lib/orders", () => ({
  checkout: mockCheckout,
  listOrders: vi.fn().mockResolvedValue([]),
  getOrderDetail: vi.fn().mockResolvedValue(null),
  cancelOrder: vi.fn().mockRejectedValue(new Error("ORDER_NOT_FOUND")),
  orderView: vi.fn(),
  orderItemView: vi.fn(),
  releaseMatureCashback: vi.fn(),
  releaseCashbackForOrder: vi.fn(),
  ensureWalletSnapshot: vi.fn(),
  listWalletTransactions: vi.fn().mockResolvedValue([]),
  walletTransactionView: vi.fn(),
  requestWithdrawal: vi.fn(),
  withdrawalView: vi.fn(),
}));

// ─── Fake order returned by the mocked checkout service ───────────────────────

const ISO_NOW = "2026-08-08T00:00:00.000Z";
const FAKE_ORDER = {
  id: "order-test-1",
  status: "pending",
  total: 1000,
  cashbackAmount: 100,
  discountAmount: 0,
  couponCode: null,
  itemsCount: 1,
  deliveredAt: null,
  completedAt: null,
  createdAt: ISO_NOW,
  updatedAt: ISO_NOW,
};

// ─── Minimal test server ──────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Dynamic import so mocks are already in place when the module loads.
  const { default: ordersRouter } = await import("../routes/orders");

  const app = express();
  app.use(express.json());
  app.use("/api", ordersRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

afterAll(() => {
  server?.close();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function postCheckout(phone: string) {
  return fetch(`${baseUrl}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deliveryAddress: {
        name: "Jane Doe",
        phone,
        address: "123 Main St",
        city: "Dhaka",
      },
    }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/checkout — phone validation", () => {
  // Reset the checkout mock before each test so call counts stay accurate.
  beforeEach(() => {
    mockCheckout.mockResolvedValue({ order: FAKE_ORDER });
  });

  // --- Invalid phones must return 422 before the checkout service is called ---

  describe("invalid phone → 422", () => {
    it('rejects alphabetic input "abc"', async () => {
      const res = await postCheckout("abc");
      expect(res.status).toBe(422);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/phone/i);
    });

    it('rejects mixed alphanumeric input "01abc234"', async () => {
      const res = await postCheckout("01abc234");
      expect(res.status).toBe(422);
    });

    it("rejects a whitespace-only phone (passes Zod min(1), fails isPhoneValid)", async () => {
      const res = await postCheckout("   ");
      expect(res.status).toBe(422);
    });

    it("rejects a 5-digit phone (below the 7-digit minimum)", async () => {
      const res = await postCheckout("12345");
      expect(res.status).toBe(422);
    });

    it("rejects a 6-digit phone (one below the 7-digit threshold)", async () => {
      const res = await postCheckout("123456");
      expect(res.status).toBe(422);
    });

    it("rejects a single-digit phone", async () => {
      const res = await postCheckout("1");
      expect(res.status).toBe(422);
    });

    it("never calls the checkout service for an invalid phone", async () => {
      mockCheckout.mockClear();
      await postCheckout("abc");
      expect(mockCheckout).not.toHaveBeenCalled();
    });
  });

  // --- Valid phones must pass validation and reach the checkout service → 201 --

  describe("valid phone → 201", () => {
    it("accepts an 11-digit BD mobile number", async () => {
      const res = await postCheckout("01700000000");
      expect(res.status).toBe(201);
    });

    it("accepts a number with a leading + country code", async () => {
      const res = await postCheckout("+8801700000000");
      expect(res.status).toBe(201);
    });

    it("accepts a formatted number with spaces and dashes (+880 17-000-00000)", async () => {
      const res = await postCheckout("+880 17-000-00000");
      expect(res.status).toBe(201);
    });

    it("accepts the 7-digit minimum-length number", async () => {
      const res = await postCheckout("1234567");
      expect(res.status).toBe(201);
    });

    it("calls the checkout service with a valid phone", async () => {
      mockCheckout.mockClear();
      await postCheckout("01700000000");
      expect(mockCheckout).toHaveBeenCalledOnce();
      const [_userId, _coupon, address] = mockCheckout.mock.calls[0] as [string, undefined, { phone: string }];
      expect(address.phone).toBe("01700000000");
    });
  });
});
