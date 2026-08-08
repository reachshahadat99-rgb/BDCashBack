import type { DeliveryAddress } from '@/hooks/useCheckoutDraft';

/**
 * Returns true when the name string:
 *   - has at least 2 non-whitespace characters after trimming
 *   - contains at least one alphabetic character (a–z, A–Z, or Unicode letters)
 *
 * Rejects: blank, whitespace-only, too-short strings, purely numeric strings,
 * and strings made entirely of punctuation / symbols (e.g. "123", "!!!").
 */
export function isNameValid(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // Must contain at least one Unicode letter (covers Latin, Bengali, Arabic, Cyrillic, etc.
  // but correctly excludes script-specific digits and punctuation).
  if (!/\p{L}/u.test(trimmed)) return false;
  return true;
}

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
    isNameValid(address.name) &&
    isPhoneValid(address.phone) &&
    address.address.trim().length > 0 &&
    address.city.trim().length > 0
  );
}
