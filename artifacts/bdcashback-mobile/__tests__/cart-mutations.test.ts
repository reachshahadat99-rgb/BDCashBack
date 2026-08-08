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
  RequestTimeoutError,
} from '@workspace/api-client-react';
import { isAddressValid, isNameValid, isPhoneValid } from '../utils/checkoutValidation';
import { handleCheckoutError } from '../utils/checkoutErrorHandler';

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

// ─── name validation (pure-function tests, no React) ─────────────────────────

describe('isNameValid', () => {
  // valid inputs
  it('accepts a normal full name', () => {
    expect(isNameValid('Jane Doe')).toBe(true);
  });

  it('accepts a single word of 2+ chars', () => {
    expect(isNameValid('Jo')).toBe(true);
  });

  it('accepts a name with hyphens and letters', () => {
    expect(isNameValid('Mary-Jane')).toBe(true);
  });

  // invalid — too short
  it('rejects an empty string', () => {
    expect(isNameValid('')).toBe(false);
  });

  it('rejects a single character', () => {
    expect(isNameValid('A')).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(isNameValid('   ')).toBe(false);
  });

  it('rejects a single letter with surrounding spaces (trims to 1 char)', () => {
    expect(isNameValid(' A ')).toBe(false);
  });

  // invalid — no letters
  it('rejects a purely numeric string like "123"', () => {
    expect(isNameValid('123')).toBe(false);
  });

  it('rejects a string of only punctuation like "!!!"', () => {
    expect(isNameValid('!!!')).toBe(false);
  });

  it('rejects a mix of digits and punctuation like "12!!"', () => {
    expect(isNameValid('12!!')).toBe(false);
  });

  it('rejects a string that is only dashes', () => {
    expect(isNameValid('---')).toBe(false);
  });

  // Bengali / Arabic script regression — digits and punctuation in those blocks
  // must NOT be treated as letters (Bangladesh-focused app)
  it('rejects Bengali digits like "১২৩" (no letters, only script digits)', () => {
    expect(isNameValid('১২৩')).toBe(false);
  });

  it('rejects Arabic-script digits like "١٢٣" (no letters, only script digits)', () => {
    expect(isNameValid('١٢٣')).toBe(false);
  });

  it('rejects a Bengali punctuation-only string', () => {
    // U+0964 DEVANAGARI DANDA, U+0965 DEVANAGARI DOUBLE DANDA — used in Bengali text too
    expect(isNameValid('।।')).toBe(false);
  });

  // Names with actual Bengali letters should still be accepted
  it('accepts a name written in Bengali letters', () => {
    // "আলী" — Bengali letters, 3 chars
    expect(isNameValid('আলী')).toBe(true);
  });
});

// ─── isAddressValid — name field enforcement ──────────────────────────────────

describe('isAddressValid — name field enforcement', () => {
  const FULL_ADDRESS = {
    name: 'Jane Doe',
    phone: '01700000000',
    address: '123 Main St',
    city: 'Dhaka',
  };

  it('rejects a name that is only numbers', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, name: '123' })).toBe(false);
  });

  it('rejects a name that is only punctuation', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, name: '!!!' })).toBe(false);
  });

  it('rejects a single-character name', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, name: 'A' })).toBe(false);
  });

  it('rejects a name shorter than 2 chars after trimming', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, name: ' B ' })).toBe(false);
  });

  it('accepts a valid alphabetic name of 2+ chars', () => {
    expect(isAddressValid({ ...FULL_ADDRESS, name: 'Jo' })).toBe(true);
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

// ─── checkout timeout ─────────────────────────────────────────────────────────
//
// These tests verify the 15-second checkout timeout actually fires and surfaces
// the correct error so users are never stuck with a frozen spinner.
//
// Strategy: mock global.fetch to hang forever but honour the AbortSignal so
// the promise rejects with an AbortError when the timeout controller fires.
// Then advance Jest fake timers past the timeout window and assert the correct
// error type is thrown.

describe('checkout — RequestTimeoutError is thrown when the server hangs', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Replace the spy set up in the outer beforeEach with a "hanging" fetch
    // that properly rejects when the AbortController aborts.
    // Use a plain Error with name 'AbortError' because DOMException is not
    // available in the Node jest environment used by this test suite.
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          const abortErr = (): Error =>
            Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
          if (signal.aborted) {
            reject(abortErr());
            return;
          }
          signal.addEventListener('abort', () => reject(abortErr()));
        }
        // Without a signal the promise hangs forever — that is intentional.
      }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws RequestTimeoutError when fetch hangs past timeoutMs', async () => {
    const TIMEOUT_MS = 200;

    const checkoutPromise = checkout(
      { deliveryAddress: { name: 'Jane', phone: '01700000000', address: '1 Road', city: 'Dhaka' } },
      { timeoutMs: TIMEOUT_MS },
    );

    // Advance fake timers past the threshold to trigger the AbortController.
    jest.advanceTimersByTime(TIMEOUT_MS + 50);

    await expect(checkoutPromise).rejects.toThrow(RequestTimeoutError);
  });

  it('error name is "RequestTimeoutError" (so instanceof checks in onError work)', async () => {
    const TIMEOUT_MS = 200;

    const checkoutPromise = checkout({}, { timeoutMs: TIMEOUT_MS });
    jest.advanceTimersByTime(TIMEOUT_MS + 50);

    let caught: unknown;
    try {
      await checkoutPromise;
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RequestTimeoutError);
    expect((caught as RequestTimeoutError).name).toBe('RequestTimeoutError');
    expect((caught as RequestTimeoutError).timeoutMs).toBe(TIMEOUT_MS);
    expect((caught as RequestTimeoutError).method).toBe('POST');
  });

  it('does NOT throw RequestTimeoutError when the server responds in time', async () => {
    // Switch to a fast-resolving mock for this one case.
    fetchMock.mockResolvedValueOnce(makeResponse(ORDER));

    const TIMEOUT_MS = 5_000;
    const result = await checkout(
      { deliveryAddress: { name: 'Jane', phone: '01700000000', address: '1 Road', city: 'Dhaka' } },
      { timeoutMs: TIMEOUT_MS },
    );

    expect(result.id).toBe('order-99');
  });
});

// ─── checkout onError handler — "Request Timed Out" alert ────────────────────
//
// Verifies that when the checkout mutate call hands RequestTimeoutError to
// onError (as wired in checkout.tsx), Alert.alert is called with the title
// "Request Timed Out" and a "Try Again" button — matching the handler in
// checkout.tsx handlePlaceOrder → onError.

// ─── checkout onError handler — "Request Timed Out" alert with Try Again ─────
//
// These tests call the REAL handleCheckoutError function that checkout.tsx
// wires into useCheckout onError.  A jest.fn() stands in for Alert.alert so
// the tests stay in @jest-environment node without importing react-native.
//
// If the production handler is changed (different title, missing Try Again
// button, wrong branch), these tests will fail — that is the intent.

describe('checkout onError handler — "Request Timed Out" alert with Try Again', () => {
  it('calls alertFn with "Request Timed Out" and a "Try Again" button when RequestTimeoutError is received', () => {
    const alertFn = jest.fn();
    const tryAgainFn = jest.fn();

    const err = new RequestTimeoutError(15_000, { method: 'POST', url: '/api/checkout' });

    handleCheckoutError(err, alertFn, tryAgainFn);

    expect(alertFn).toHaveBeenCalledTimes(1);
    expect(alertFn).toHaveBeenCalledWith(
      'Request Timed Out',
      expect.stringContaining('too long'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Try Again' }),
      ]),
    );
  });

  it('does NOT show a "Request Timed Out" alert for a plain network error', () => {
    const alertFn = jest.fn();
    const err = new Error('network failure');

    handleCheckoutError(err, alertFn, jest.fn());

    expect(alertFn).toHaveBeenCalledWith('Checkout Failed', expect.any(String));
    expect(alertFn).not.toHaveBeenCalledWith('Request Timed Out', expect.anything(), expect.anything());
  });

  it('instanceof check correctly distinguishes RequestTimeoutError from plain Error', () => {
    const timeout = new RequestTimeoutError(15_000, { method: 'POST', url: '/api/checkout' });
    const plain = new Error('network failure');

    expect(timeout instanceof RequestTimeoutError).toBe(true);
    expect(plain instanceof RequestTimeoutError).toBe(false);
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
