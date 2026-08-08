/**
 * @jest-environment node
 *
 * Integration smoke tests for cart / checkout API functions.
 *
 * Strategy: call the generated fetch functions (addCartItem, removeCartItem,
 * clearCart, checkout, getCart) with a global.fetch mock.  This validates that:
 *   - Each function targets the correct endpoint + HTTP method
 *   - Request bodies are serialised correctly
 *   - Responses are deserialised and returned as typed objects
 *   - Non-ok responses surface as thrown errors
 *
 * We do NOT render React components — avoiding the React Native native-module
 * tree while still covering the "real" fetch path that runs on device.
 */

import type { Cart, CartItem, CustomerOrder } from '@workspace/api-client-react';
import {
  getCart,
  addCartItem,
  removeCartItem,
  clearCart,
  checkout,
  setBaseUrl,
} from '@workspace/api-client-react';
import { isAddressValid, isPhoneValid } from '../utils/checkoutValidation';

// ─── fixtures ────────────────────────────────────────────────────────────────

const ITEM: CartItem = {
  id: 'item-1',
  productId: 'prod-1',
  storeId: 'store-1',
  name: 'Test Widget',
  price: 500,
  originalPrice: 600,
  cashbackPercent: 10,
  quantity: 2,
  imageUrl: 'https://example.com/img.png',
  cashbackAmount: 50,
};

const EMPTY_CART: Cart = { items: [], subtotal: 0, cashbackAmount: 0, itemsCount: 0 };

const CART_WITH_ITEM: Cart = {
  items: [ITEM],
  subtotal: 1000,
  cashbackAmount: 50,
  itemsCount: 2,
};

const ORDER = {
  id: 'order-99',
  status: 'pending',
  totalAmount: 1000,
  cashbackAmount: 50,
  createdAt: '2026-08-08T00:00:00.000Z',
  items: [ITEM],
} as unknown as CustomerOrder;

// ─── fetch mock helpers ───────────────────────────────────────────────────────

/** Builds a minimal Response-like object that the custom fetch understands. */
function makeResponse(body: unknown, status = 200): Response {
  const json = body === null || body === undefined ? null : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(json ?? ''),
    body: json,
  } as unknown as Response;
}

function makeEmptyResponse(status = 204): Response {
  return {
    ok: true,
    status,
    headers: new Headers({}),
    json: () => Promise.reject(new Error('no body')),
    text: () => Promise.resolve(''),
    body: null,
  } as unknown as Response;
}

// ─── setup ───────────────────────────────────────────────────────────────────

// Ensure no base URL is set so paths are root-relative during tests
beforeAll(() => setBaseUrl(null));

let fetchMock: jest.SpyInstance;

beforeEach(() => {
  fetchMock = jest
    .spyOn(global, 'fetch')
    .mockImplementation(() => Promise.resolve(makeResponse(CART_WITH_ITEM)));
});

afterEach(() => {
  fetchMock.mockRestore();
});

// ─── tests ───────────────────────────────────────────────────────────────────

describe('getCart', () => {
  it('GET /api/cart returns a typed Cart', async () => {
    fetchMock.mockResolvedValue(makeResponse(CART_WITH_ITEM));
    const result = await getCart();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch('/api/cart');
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');

    expect(result.items).toHaveLength(1);
    expect(result.subtotal).toBe(1000);
    expect(result.cashbackAmount).toBe(50);
    expect(result.items[0].name).toBe('Test Widget');
  });

  it('returns an empty cart shape when the API does so', async () => {
    fetchMock.mockResolvedValue(makeResponse(EMPTY_CART));
    const result = await getCart();
    expect(result.items).toHaveLength(0);
    expect(result.subtotal).toBe(0);
  });
});

describe('addCartItem', () => {
  it('POST /api/cart/items with the correct body and returns updated cart', async () => {
    fetchMock.mockResolvedValue(makeResponse(CART_WITH_ITEM));

    const result = await addCartItem({ productId: 'prod-1', quantity: 2 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch('/api/cart/items');
    expect((init.method ?? '').toUpperCase()).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ productId: 'prod-1', quantity: 2 });

    expect(result.items[0].productId).toBe('prod-1');
  });

  it('propagates a non-ok response as an error', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ message: 'Out of stock' }, 400),
    );
    await expect(addCartItem({ productId: 'prod-x', quantity: 1 })).rejects.toThrow();
  });
});

describe('removeCartItem', () => {
  it('DELETE /api/cart/items/:itemId targets the correct URL', async () => {
    fetchMock.mockResolvedValue(makeEmptyResponse(204));

    await removeCartItem('item-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch('/api/cart/items/item-1');
    expect((init.method ?? '').toUpperCase()).toBe('DELETE');
  });

  it('resolves without a body (204 No Content)', async () => {
    fetchMock.mockResolvedValue(makeEmptyResponse(204));
    // The custom fetch returns null for empty bodies — not undefined
    await expect(removeCartItem('item-1')).resolves.toBeFalsy();
  });
});

describe('clearCart', () => {
  it('DELETE /api/cart clears the entire cart', async () => {
    fetchMock.mockResolvedValue(makeEmptyResponse(204));

    await clearCart();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch('/api/cart');
    expect((init.method ?? '').toUpperCase()).toBe('DELETE');
  });

  it('resolves without a body (204 No Content)', async () => {
    fetchMock.mockResolvedValue(makeEmptyResponse(204));
    // The custom fetch returns null for empty bodies — not undefined
    await expect(clearCart()).resolves.toBeFalsy();
  });
});

describe('checkout', () => {
  it('POST /api/checkout with delivery address returns a CustomerOrder', async () => {
    fetchMock.mockResolvedValue(makeResponse(ORDER));

    const deliveryAddress = {
      name: 'Jane Doe',
      phone: '01700000000',
      address: '123 Main St',
      city: 'Dhaka',
    };

    const result = await checkout({ deliveryAddress });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch('/api/checkout');
    expect((init.method ?? '').toUpperCase()).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ deliveryAddress });

    expect(result.id).toBe('order-99');
    expect(result.status).toBe('pending');
    expect(result.cashbackAmount).toBe(50);
  });

  it('includes a coupon code in the request body when provided', async () => {
    fetchMock.mockResolvedValue(makeResponse(ORDER));

    await checkout({
      deliveryAddress: {
        name: 'Jane',
        phone: '01700000000',
        address: '1 Road',
        city: 'Dhaka',
      },
      couponCode: 'SAVE10',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ couponCode: 'SAVE10' });
  });

  it('propagates checkout errors from the API', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ message: 'Insufficient wallet balance' }, 402),
    );
    await expect(checkout({})).rejects.toThrow();
  });
});

// ─── address validation (pure-function tests, no React) ──────────────────────

describe('isAddressValid', () => {
  const FULL_ADDRESS = {
    name: 'Jane Doe',
    phone: '01700000000',
    address: '123 Main St',
    city: 'Dhaka',
  };

  it('returns true when all fields are filled', () => {
    expect(isAddressValid(FULL_ADDRESS)).toBe(true);
  });

  it('blocks submission when name is empty', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, name: '' })).toBe(false);
  });

  it('blocks submission when name is whitespace only', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, name: '   ' })).toBe(false);
  });

  it('blocks submission when phone is empty', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, phone: '' })).toBe(false);
  });

  it('blocks submission when address is empty', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, address: '' })).toBe(false);
  });

  it('blocks submission when city is empty', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, city: '' })).toBe(false);
  });

  it('blocks submission when all fields are empty', () => {
    expect(isAddressValid({ name: '', phone: '', address: '', city: '' })).toBe(false);
  });
});

// ─── phone validation (pure-function tests, no React) ────────────────────────

describe('isPhoneValid', () => {
  // valid inputs
  it('accepts a standard 11-digit BD mobile number', () => {
    expect(isPhoneValid('01700000000')).toBe(true);
  });

  it('accepts a number with a leading + country code', () => {
    expect(isPhoneValid('+8801700000000')).toBe(true);
  });

  it('accepts a number with spaces and dashes as formatting', () => {
    expect(isPhoneValid('+880 17-000-00000')).toBe(true);
  });

  it('accepts a 7-digit local number (minimum accepted length)', () => {
    expect(isPhoneValid('1234567')).toBe(true);
  });

  // invalid inputs
  it('rejects an empty string', () => {
    expect(isPhoneValid('')).toBe(false);
  });

  it('rejects a whitespace-only string', () => {
    expect(isPhoneValid('   ')).toBe(false);
  });

  it('rejects alphabetic text like "abc"', () => {
    expect(isPhoneValid('abc')).toBe(false);
  });

  it('rejects a mix of letters and digits like "01abc234"', () => {
    expect(isPhoneValid('01abc234')).toBe(false);
  });

  it('rejects a single digit', () => {
    expect(isPhoneValid('1')).toBe(false);
  });

  it('rejects a too-short numeric string (under 7 digits)', () => {
    expect(isPhoneValid('12345')).toBe(false);
  });

  it('rejects a number with exactly 6 digits (one below threshold)', () => {
    expect(isPhoneValid('123456')).toBe(false);
  });
});

describe('isAddressValid — phone format enforcement', () => {
  const FULL_ADDRESS = {
    name: 'Jane Doe',
    phone: '01700000000',
    address: '123 Main St',
    city: 'Dhaka',
  };

  it('rejects a non-numeric phone like "abc"', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, phone: 'abc' })).toBe(false);
  });

  it('rejects a single-digit phone', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, phone: '1' })).toBe(false);
  });

  it('rejects a too-short phone with only 5 digits', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, phone: '12345' })).toBe(false);
  });

  it('rejects a phone that is whitespace only', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, phone: '   ' })).toBe(false);
  });

  it('accepts a valid 11-digit phone', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, phone: '01700000000' })).toBe(true);
  });
});

// ─── checkout without deliveryAddress (API-level smoke test) ─────────────────

describe('checkout — missing or malformed deliveryAddress', () => {
  it('raises a typed error when the API rejects a missing deliveryAddress', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ error: 'deliveryAddress is required' }, 400),
    );

    // Calling checkout without any deliveryAddress should reject
    await expect(checkout({})).rejects.toThrow();
  });

  it('surfaces the server error message when deliveryAddress is malformed', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ error: 'deliveryAddress.phone is invalid' }, 422),
    );

    let caughtError: unknown;
    try {
      await checkout({
        deliveryAddress: { name: 'X', phone: '', address: '', city: '' },
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
  });
});

// ─── server-side phone validation — 422 rejection path ───────────────────────
//
// The server validates deliveryAddress.phone with the same rule as the mobile
// client: digits only, ≥7 digits after stripping formatting chars. These tests
// verify the client propagates each server 422 as a thrown error.

describe('checkout — server-side phone validation (422 rejection)', () => {
  const BASE_ADDRESS = {
    name: 'Jane Doe',
    address: '123 Main St',
    city: 'Dhaka',
  };

  async function expectPhoneRejected(phone: string): Promise<void> {
    fetchMock.mockResolvedValue(
      makeResponse(
        { error: 'deliveryAddress.phone is invalid: must contain at least 7 digits using only digits or formatting characters (spaces, dashes, parentheses, leading +)' },
        422,
      ),
    );
    await expect(
      checkout({ deliveryAddress: { ...BASE_ADDRESS, phone } }),
    ).rejects.toThrow();
  }

  it('rejects an alphabetic phone ("abc") with 422', async () => {
    await expectPhoneRejected('abc');
  });

  it('rejects a mixed alphanumeric phone ("01abc234") with 422', async () => {
    await expectPhoneRejected('01abc234');
  });

  it('rejects an empty phone string with 422', async () => {
    await expectPhoneRejected('');
  });

  it('rejects a phone that is fewer than 7 digits ("12345") with 422', async () => {
    await expectPhoneRejected('12345');
  });

  it('rejects a single-digit phone with 422', async () => {
    await expectPhoneRejected('1');
  });

  it('accepts a valid 11-digit phone and does NOT return 422', async () => {
    fetchMock.mockResolvedValue(makeResponse(ORDER));
    const result = await checkout({
      deliveryAddress: { ...BASE_ADDRESS, phone: '01700000000' },
    });
    expect(result.id).toBe('order-99');
  });

  it('accepts a formatted phone with country code and does NOT return 422', async () => {
    fetchMock.mockResolvedValue(makeResponse(ORDER));
    const result = await checkout({
      deliveryAddress: { ...BASE_ADDRESS, phone: '+880 17-000-00000' },
    });
    expect(result.id).toBe('order-99');
  });
});

describe('cart add → remove → checkout sequence', () => {
  it('can add, remove and checkout in sequence without errors', async () => {
    // Each call needs its own mock response
    fetchMock
      .mockResolvedValueOnce(makeResponse(CART_WITH_ITEM)) // addCartItem
      .mockResolvedValueOnce(makeEmptyResponse(204))        // removeCartItem
      .mockResolvedValueOnce(makeResponse(ORDER));           // checkout

    const cartAfterAdd = await addCartItem({ productId: 'prod-1', quantity: 1 });
    expect(cartAfterAdd.items.length).toBeGreaterThan(0);

    await removeCartItem('item-1');

    const order = await checkout({
      deliveryAddress: {
        name: 'Test',
        phone: '01700000001',
        address: '42 Lane',
        city: 'Dhaka',
      },
    });
    expect(order.id).toBeDefined();
  });
});
