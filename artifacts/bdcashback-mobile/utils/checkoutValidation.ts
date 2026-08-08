import type { DeliveryAddress } from '@/hooks/useCheckoutDraft';

/**
 * Returns true when every required delivery-address field is non-empty.
 * Extracted as a pure function so it can be unit-tested without React.
 */
export function isAddressValid(address: DeliveryAddress): boolean {
  return (
    address.name.trim().length > 0 &&
    address.phone.trim().length > 0 &&
    address.address.trim().length > 0 &&
    address.city.trim().length > 0
  );
}
