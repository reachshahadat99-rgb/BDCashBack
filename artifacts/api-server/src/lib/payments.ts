/**
 * Typed payment integration point.
 *
 * The real payment/wallet engine (checkout, cashback, withdrawals) is owned by a
 * separate workstream. Modules that need to take money (gift cards, group buy
 * deposits) must go through this interface so the recorded implementation can be
 * swapped for a verified gateway/wallet debit without touching module logic.
 */
export type PaymentMethod = "bkash" | "nagad" | "card";

export interface PaymentCharge {
  /** Opaque reference for reconciliation with the payment engine. */
  reference: string;
  method: PaymentMethod;
  amount: number;
  status: "recorded";
}

export interface PaymentService {
  /** Charge the customer. Resolves with a reference; throws on failure. */
  charge(input: {
    customerId: string;
    amount: number;
    method: PaymentMethod;
    purpose: string;
  }): Promise<PaymentCharge>;
}

/**
 * Placeholder implementation: records the intent and returns a synthetic
 * reference. Replace with the verified payment engine implementation.
 */
export const recordedPaymentService: PaymentService = {
  async charge({ amount, method }) {
    if (amount <= 0) throw new Error("Charge amount must be positive");
    return {
      reference: `${method.toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      method,
      amount,
      status: "recorded",
    };
  },
};
