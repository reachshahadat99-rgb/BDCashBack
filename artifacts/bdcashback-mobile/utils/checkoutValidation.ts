import type { DeliveryAddress } from '@/hooks/useCheckoutDraft';

/**
 * Returns true when the phone string contains at least 7 digits and only
 * consists of digits plus common formatting characters (spaces, dashes,
 * parentheses, leading +).
 *
 * Rejects: blank, whitespace-only, purely alphabetic strings, too-short numbers.
 */
export function isPhoneValid(phone: string): boolean {
  const stripped = phone.trim();
  if (stripped.length === 0) return false;

  // Strip common formatting characters; whatever remains must be all digits
  const digitsOnly = stripped.replace(/[\s\-+()]/g, '');
  if (digitsOnly.length === 0) return false;
  if (!/^\d+$/.test(digitsOnly)) return false;   // rejects 'abc', '01abc', etc.
  if (digitsOnly.length < 7) return false;         // rejects single-digit or too-short numbers

  return true;
}

/**
 * Returns true when every required delivery-address field is non-empty and
 * the phone number passes format validation.
 * Extracted as a pure function so it can be unit-tested without React.
 */
export function isAddressValid(address: DeliveryAddress): boolean {
  return (
    address.name.trim().length > 0 &&
    isPhoneValid(address.phone) &&
    address.address.trim().length > 0 &&
    address.city.trim().length > 0
  );
}
