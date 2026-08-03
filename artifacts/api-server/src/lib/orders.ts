/**
 * Backward-compatibility barrel.
 *
 * All business logic has moved into domain service modules:
 *   - Cart + orders + cashback → domains/orders/orders.service.ts
 *   - Wallet + withdrawals    → domains/wallet/wallet.service.ts
 *
 * Existing route files continue to import from here unchanged.
 * New code should import directly from the domain module.
 */

export {
  // Cart
  getOrCreateCart,
  getCartWithItems,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  // Checkout + order lifecycle
  checkout,
  listOrders,
  getOrderDetail,
  cancelOrder,
  orderView,
  orderItemView,
  // Cashback release
  releaseMatureCashback,
  releaseCashbackForOrder,
} from "../domains/orders/orders.service";

export {
  // Wallet
  ensureWalletSnapshot,
  listWalletTransactions,
  walletTransactionView,
  // Withdrawals
  requestWithdrawal,
  withdrawalView,
} from "../domains/wallet/wallet.service";
