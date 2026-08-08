import { RequestTimeoutError } from '@workspace/api-client-react';

/**
 * Minimal Alert-compatible signature that matches React Native's Alert.alert
 * and can be satisfied by a jest.fn() in @jest-environment node tests without
 * importing react-native.
 *
 * `message` and `buttons` are optional to match Alert.alert's real signature.
 * Button `text` and `onPress` are also optional for the same reason.
 */
export type AlertFn = (
  title: string,
  message?: string,
  buttons?: Array<{ text?: string; onPress?: (() => void) | null; style?: string }>,
) => void;

/**
 * Handles the onError callback from the checkout mutation in checkout.tsx.
 *
 * Extracted as a pure function (react-native-free) so it can be unit-tested
 * without rendering the component tree.
 *
 * @param err    - The error thrown by the checkout mutation
 * @param alertFn - The alert function to call (pass Alert.alert in production,
 *                  a jest.fn() in tests)
 * @param onTryAgain - Called when the user taps "Try Again" after a timeout
 */
export function handleCheckoutError(
  err: unknown,
  alertFn: AlertFn,
  onTryAgain: () => void,
): void {
  if (err instanceof RequestTimeoutError) {
    alertFn(
      'Request Timed Out',
      'The server took too long to respond. Please check your connection and try again.',
      [
        { text: 'Try Again', onPress: onTryAgain },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
    return;
  }

  const msg =
    err && typeof err === 'object' && 'error' in err
      ? String((err as Record<string, unknown>).error)
      : 'Could not complete checkout.';
  alertFn('Checkout Failed', msg);
}
