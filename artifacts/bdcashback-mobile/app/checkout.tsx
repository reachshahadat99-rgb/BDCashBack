import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import {
  useGetCart,
  useCheckout,
  useValidateCoupon,
  getGetCartQueryKey,
  getListOrdersQueryKey,
  RequestTimeoutError,
  type CartItem,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';
import { useCheckoutDraft, type DeliveryAddress } from '@/hooks/useCheckoutDraft';
import { scheduleLocalNotification } from '@/hooks/usePushNotifications';
import { isAddressValid, isPhoneValid } from '@/utils/checkoutValidation';

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS: Record<Step, string> = {
  0: 'Delivery Address',
  1: 'Payment Method',
  2: 'Review Order',
  3: 'Order Placed',
};

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ couponCode?: string; couponDiscount?: string }>();

  const [step, setStep] = useState<Step>(0);
  const { draft, setDraft, clearDraft, loaded } = useCheckoutDraft();
  const { data: cart } = useGetCart({ query: { enabled: !!isSignedIn, queryKey: getGetCartQueryKey() } });
  const CHECKOUT_TIMEOUT_MS = 15_000;
  const checkout = useCheckout({ request: { timeoutMs: CHECKOUT_TIMEOUT_MS } });
  const validateCoupon = useValidateCoupon();

  const [placedOrder, setPlacedOrder] = useState<{ id: string; cashbackAmount: number } | null>(null);

  // Coupon state — initialized from cart screen params
  const [couponCode, setCouponCode] = useState(params.couponCode ?? '');
  const [couponInput, setCouponInput] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(
    params.couponDiscount ? parseFloat(params.couponDiscount) : 0,
  );

  const topInset = Platform.OS === 'web' ? 20 : insets.top;
  const styles = makeStyles(colors);

  const subtotal = cart?.subtotal ?? 0;
  const cashback = cart?.cashbackAmount ?? 0;
  const finalTotal = Math.max(0, subtotal - couponDiscount);

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (step === 0) {
      router.back();
    } else if (step < 3) {
      setStep((s) => (s - 1) as Step);
    }
  }, [step, router]);

  // ── Step validation ───────────────────────────────────────────────────────

  const addressValid = isAddressValid(draft.address);

  const handleNextFromAddress = useCallback(() => {
    if (!addressValid) {
      if (!isPhoneValid(draft.address.phone)) {
        Alert.alert('Invalid Phone', 'Please enter a valid phone number (digits only, at least 7 digits).');
      } else {
        Alert.alert('Missing Details', 'Please fill in all address fields.');
      }
      return;
    }
    Haptics.selectionAsync();
    setStep(1);
  }, [addressValid, draft.address.phone]);

  const handleNextFromPayment = useCallback(() => {
    Haptics.selectionAsync();
    setStep(2);
  }, []);

  // ── Coupon ────────────────────────────────────────────────────────────────

  const handleApplyCoupon = useCallback(() => {
    if (!couponInput.trim()) return;
    validateCoupon.mutate(
      { data: { code: couponInput.trim().toUpperCase(), subtotal } },
      {
        onSuccess: (result) => {
          if (result.valid) {
            setCouponCode(couponInput.trim().toUpperCase());
            setCouponDiscount(result.discountAmount);
            setCouponInput('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Alert.alert('Invalid Coupon', result.reason ?? 'Coupon is not valid.');
          }
        },
        onError: () => Alert.alert('Error', 'Could not validate coupon.'),
      },
    );
  }, [couponInput, subtotal, validateCoupon]);

  // ── Place order ───────────────────────────────────────────────────────────

  const handlePlaceOrder = useCallback(() => {
    if (!cart?.items.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    checkout.mutate(
      {
        data: {
          couponCode: couponCode || undefined,
          deliveryAddress: {
            name: draft.address.name,
            phone: draft.address.phone,
            address: draft.address.address,
            city: draft.address.city,
          },
        },
      },
      {
        onSuccess: (order) => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          clearDraft();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPlacedOrder({ id: order.id, cashbackAmount: order.cashbackAmount });
          setStep(3);
          scheduleLocalNotification(
            '🎉 Order Confirmed!',
            `Order #${order.id.slice(-6).toUpperCase()} is being processed. You'll earn ৳${order.cashbackAmount.toFixed(2)} cashback.`,
          );
        },
        onError: (err: unknown) => {
          if (err instanceof RequestTimeoutError) {
            Alert.alert(
              'Request Timed Out',
              'The server took too long to respond. Please check your connection and try again.',
              [
                { text: 'Try Again', onPress: handlePlaceOrder },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
            return;
          }
          const msg =
            err && typeof err === 'object' && 'error' in err
              ? String((err as any).error)
              : 'Could not complete checkout.';
          Alert.alert('Checkout Failed', msg);
        },
      },
    );
  }, [cart, couponCode, draft, checkout, queryClient, clearDraft]);

  // ── Redirect if not signed in ─────────────────────────────────────────────

  if (!isSignedIn) {
    router.replace('/(auth)/sign-in');
    return null;
  }

  if (!loaded) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (step === 3 && placedOrder) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <LinearGradient
          colors={[colors.primary + '22', colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: colors.primary + '20' }]}>
            <Feather name="check-circle" size={56} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Order Placed!</Text>
          <Text style={[styles.successOrderId, { color: colors.mutedForeground }]}>
            Order #{placedOrder.id.slice(-8).toUpperCase()}
          </Text>
          <View style={[styles.cashbackBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
            <Feather name="trending-up" size={16} color={colors.primary} />
            <Text style={[styles.cashbackBadgeText, { color: colors.primary }]}>
              ৳{placedOrder.cashbackAmount.toFixed(2)} cashback will be credited after delivery
            </Text>
          </View>
          <Text style={[styles.successSubtitle, { color: colors.mutedForeground }]}>
            Your delivery address and order details have been saved. We'll notify you when your order ships.
          </Text>
          <TouchableOpacity
            style={[styles.successBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(tabs)/orders')}
            activeOpacity={0.85}
          >
            <Feather name="list" size={18} color={colors.primaryForeground} />
            <Text style={[styles.successBtnText, { color: colors.primaryForeground }]}>Track Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.successBtnOutline, { borderColor: colors.border }]}
            onPress={() => router.replace('/')}
            activeOpacity={0.85}
          >
            <Text style={[styles.successBtnOutlineText, { color: colors.foreground }]}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main checkout wizard ──────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {STEP_LABELS[step]}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Step progress indicator */}
      <View style={styles.stepsRow}>
        {([0, 1, 2] as Step[]).map((s) => (
          <React.Fragment key={s}>
            <View style={styles.stepDot}>
              <View style={[
                styles.dot,
                {
                  backgroundColor: s <= step ? colors.primary : colors.muted,
                  borderColor: s === step ? colors.primary : 'transparent',
                },
              ]}>
                {s < step ? (
                  <Feather name="check" size={10} color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.dotText, { color: s === step ? colors.primaryForeground : colors.mutedForeground }]}>
                    {s + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, { color: s === step ? colors.primary : colors.mutedForeground }]}>
                {s === 0 ? 'Address' : s === 1 ? 'Payment' : 'Review'}
              </Text>
            </View>
            {s < 2 && (
              <View style={[styles.stepLine, { backgroundColor: s < step ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Step content */}
      {step === 0 && (
        <AddressStep
          address={draft.address}
          onChange={(address) => setDraft({ address })}
          onNext={handleNextFromAddress}
          colors={colors}
          styles={styles}
        />
      )}
      {step === 1 && (
        <PaymentStep
          paymentMethod={draft.paymentMethod}
          onChange={(paymentMethod) => setDraft({ paymentMethod })}
          onNext={handleNextFromPayment}
          colors={colors}
          styles={styles}
        />
      )}
      {step === 2 && (
        <ReviewStep
          cart={cart}
          address={draft.address}
          paymentMethod={draft.paymentMethod}
          couponCode={couponCode}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          couponDiscount={couponDiscount}
          subtotal={subtotal}
          cashback={cashback}
          finalTotal={finalTotal}
          onApplyCoupon={handleApplyCoupon}
          isValidating={validateCoupon.isPending}
          onPlaceOrder={handlePlaceOrder}
          isPlacing={checkout.isPending}
          colors={colors}
          styles={styles}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step sub-components
// ─────────────────────────────────────────────────────────────────────────────

function AddressStep({
  address, onChange, onNext, colors, styles,
}: {
  address: DeliveryAddress;
  onChange: (a: DeliveryAddress) => void;
  onNext: () => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneError = phoneTouched && !isPhoneValid(address.phone)
    ? 'Enter a valid phone number (digits only, at least 7 digits)'
    : null;

  const field = (key: keyof DeliveryAddress, label: string, placeholder: string, keyboardType?: 'default' | 'phone-pad') => (
    <View style={styles.fieldGroup} key={key}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.muted,
            color: colors.foreground,
            borderColor: key === 'phone' && phoneError ? colors.destructive : colors.border,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={address[key]}
        onChangeText={(v) => onChange({ ...address, [key]: v })}
        onBlur={key === 'phone' ? () => setPhoneTouched(true) : undefined}
        keyboardType={keyboardType ?? 'default'}
        returnKeyType="next"
      />
      {key === 'phone' && phoneError && (
        <Text style={[styles.fieldError, { color: colors.destructive }]}>{phoneError}</Text>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepDescription, { color: colors.mutedForeground }]}>
        Where should we deliver your order?
      </Text>
      {field('name', 'Full Name', 'Your full name')}
      {field('phone', 'Phone Number', '+880 1XXX XXX XXX', 'phone-pad')}
      {field('address', 'Street Address', 'House / Road / Area')}
      {field('city', 'City', 'Dhaka')}
      <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={onNext} activeOpacity={0.85}>
        <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Continue to Payment</Text>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </TouchableOpacity>
    </ScrollView>
  );
}

function PaymentStep({
  paymentMethod, onChange, onNext, colors, styles,
}: {
  paymentMethod: 'cod' | 'wallet';
  onChange: (m: 'cod' | 'wallet') => void;
  onNext: () => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const options: Array<{ id: 'cod' | 'wallet'; icon: string; title: string; subtitle: string }> = [
    { id: 'cod', icon: 'truck', title: 'Cash on Delivery', subtitle: 'Pay when your order arrives' },
    { id: 'wallet', icon: 'credit-card', title: 'Wallet Balance', subtitle: 'Use your cashback wallet balance' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={[styles.stepDescription, { color: colors.mutedForeground }]}>
        How would you like to pay?
      </Text>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={[
            styles.paymentOption,
            {
              backgroundColor: colors.card,
              borderColor: paymentMethod === opt.id ? colors.primary : colors.border,
              borderWidth: paymentMethod === opt.id ? 2 : 1,
            },
          ]}
          onPress={() => { Haptics.selectionAsync(); onChange(opt.id); }}
          activeOpacity={0.85}
        >
          <View style={[styles.paymentIconWrap, { backgroundColor: paymentMethod === opt.id ? colors.primary + '18' : colors.muted }]}>
            <Feather name={opt.icon as any} size={22} color={paymentMethod === opt.id ? colors.primary : colors.mutedForeground} />
          </View>
          <View style={styles.paymentText}>
            <Text style={[styles.paymentTitle, { color: colors.foreground }]}>{opt.title}</Text>
            <Text style={[styles.paymentSubtitle, { color: colors.mutedForeground }]}>{opt.subtitle}</Text>
          </View>
          {paymentMethod === opt.id && (
            <Feather name="check-circle" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={onNext} activeOpacity={0.85}>
        <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Review Order</Text>
        <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
      </TouchableOpacity>
    </ScrollView>
  );
}

function ReviewStep({
  cart, address, paymentMethod, couponCode, couponInput, setCouponInput,
  couponDiscount, subtotal, cashback, finalTotal,
  onApplyCoupon, isValidating, onPlaceOrder, isPlacing, colors, styles,
}: {
  cart: any;
  address: DeliveryAddress;
  paymentMethod: 'cod' | 'wallet';
  couponCode: string;
  couponInput: string;
  setCouponInput: (v: string) => void;
  couponDiscount: number;
  subtotal: number;
  cashback: number;
  finalTotal: number;
  onApplyCoupon: () => void;
  isValidating: boolean;
  onPlaceOrder: () => void;
  isPlacing: boolean;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.stepContent, { paddingBottom: 120 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Delivery summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryCardHeader}>
          <Feather name="map-pin" size={14} color={colors.primary} />
          <Text style={[styles.summaryCardTitle, { color: colors.foreground }]}>Deliver to</Text>
        </View>
        <Text style={[styles.summaryCardValue, { color: colors.foreground }]}>{address.name}</Text>
        <Text style={[styles.summaryCardSub, { color: colors.mutedForeground }]}>
          {address.address}, {address.city}
        </Text>
        <Text style={[styles.summaryCardSub, { color: colors.mutedForeground }]}>{address.phone}</Text>
      </View>

      {/* Payment summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryCardHeader}>
          <Feather name="credit-card" size={14} color={colors.primary} />
          <Text style={[styles.summaryCardTitle, { color: colors.foreground }]}>Payment</Text>
        </View>
        <Text style={[styles.summaryCardValue, { color: colors.foreground }]}>
          {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Wallet Balance'}
        </Text>
      </View>

      {/* Cart items */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Items ({cart?.itemsCount ?? 0})
      </Text>
      {(cart?.items ?? []).map((item: CartItem) => (
        <View key={item.id} style={[styles.orderItem, { borderColor: colors.border }]}>
          <View style={styles.orderItemQty}>
            <Text style={[styles.orderItemQtyText, { color: colors.mutedForeground }]}>×{item.quantity}</Text>
          </View>
          <Text style={[styles.orderItemName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.orderItemPrice, { color: colors.foreground }]}>
            ৳{(item.price * item.quantity).toLocaleString()}
          </Text>
        </View>
      ))}

      {/* Coupon */}
      {!couponCode && (
        <View style={styles.couponRow}>
          <TextInput
            style={[styles.couponInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Coupon code"
            placeholderTextColor={colors.mutedForeground}
            value={couponInput}
            onChangeText={setCouponInput}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.couponBtn, { backgroundColor: colors.primary }]}
            onPress={onApplyCoupon}
            disabled={isValidating}
          >
            {isValidating
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Text style={[styles.couponBtnText, { color: colors.primaryForeground }]}>Apply</Text>}
          </TouchableOpacity>
        </View>
      )}
      {couponCode && (
        <Text style={[styles.couponApplied, { color: colors.primary }]}>
          ✓ {couponCode} — saved ৳{couponDiscount.toFixed(2)}
        </Text>
      )}

      {/* Price breakdown */}
      <View style={[styles.priceBreakdown, { borderColor: colors.border }]}>
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
          <Text style={[styles.priceValue, { color: colors.foreground }]}>৳{subtotal.toLocaleString()}</Text>
        </View>
        {couponDiscount > 0 && (
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.primary }]}>Discount</Text>
            <Text style={[styles.priceValue, { color: colors.primary }]}>−৳{couponDiscount.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Cashback earned</Text>
          <Text style={[styles.priceValue, { color: colors.primary }]}>+৳{cashback.toFixed(2)}</Text>
        </View>
        <View style={[styles.priceRow, styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.foreground }]}>৳{finalTotal.toLocaleString()}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.placeOrderBtn, { backgroundColor: isPlacing ? colors.mutedForeground : colors.primary }]}
        onPress={onPlaceOrder}
        disabled={isPlacing || !cart?.items.length}
        activeOpacity={0.85}
      >
        {isPlacing ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="check-circle" size={18} color={colors.primaryForeground} />
            <Text style={[styles.placeOrderBtnText, { color: colors.primaryForeground }]}>
              Place Order · ৳{finalTotal.toLocaleString()}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Success screen
    successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    successContent: { alignItems: 'center', paddingHorizontal: 32, gap: 12 },
    successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    successTitle: { fontSize: 28, fontFamily: FONT_BOLD, textAlign: 'center' },
    successOrderId: { fontSize: 14, fontFamily: FONT_MEDIUM },
    cashbackBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    },
    cashbackBadgeText: { fontSize: 13, fontFamily: FONT_SEMIBOLD, flexShrink: 1 },
    successSubtitle: { fontSize: 14, fontFamily: FONT_REGULAR, textAlign: 'center', lineHeight: 20 },
    successBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
      paddingVertical: 15, borderRadius: colors.radius, justifyContent: 'center', marginTop: 8,
    },
    successBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
    successBtnOutline: {
      flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
      paddingVertical: 14, borderRadius: colors.radius, justifyContent: 'center', borderWidth: 1,
    },
    successBtnOutlineText: { fontSize: 15, fontFamily: FONT_MEDIUM },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: { flex: 1, fontSize: 18, fontFamily: FONT_BOLD, textAlign: 'center' },
    headerSpacer: { width: 30 },

    // Step progress
    stepsRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 32, paddingVertical: 12,
    },
    stepDot: { alignItems: 'center', gap: 4 },
    dot: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    dotText: { fontSize: 12, fontFamily: FONT_BOLD },
    stepLabel: { fontSize: 10, fontFamily: FONT_MEDIUM },
    stepLine: { flex: 1, height: 2, marginHorizontal: 4, marginBottom: 16 },

    // Step content
    stepContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
    stepDescription: { fontSize: 14, fontFamily: FONT_REGULAR, marginBottom: 20, lineHeight: 20 },

    // Address fields
    fieldGroup: { marginBottom: 16 },
    fieldLabel: { fontSize: 12, fontFamily: FONT_MEDIUM, marginBottom: 6 },
    fieldInput: {
      height: 48, borderRadius: colors.radius, borderWidth: 1,
      paddingHorizontal: 14, fontSize: 15, fontFamily: FONT_REGULAR,
    },
    fieldError: { fontSize: 12, fontFamily: FONT_REGULAR, marginTop: 4 },

    // Payment options
    paymentOption: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16, borderRadius: colors.radius, marginBottom: 12,
    },
    paymentIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    paymentText: { flex: 1 },
    paymentTitle: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    paymentSubtitle: { fontSize: 12, fontFamily: FONT_REGULAR, marginTop: 2 },

    // Next / place order buttons
    nextBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 15, borderRadius: colors.radius, marginTop: 24,
    },
    nextBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
    placeOrderBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 15, borderRadius: colors.radius, marginTop: 16,
    },
    placeOrderBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },

    // Review step
    summaryCard: {
      borderRadius: colors.radius, borderWidth: 1, padding: 14, marginBottom: 12,
    },
    summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    summaryCardTitle: { fontSize: 12, fontFamily: FONT_SEMIBOLD },
    summaryCardValue: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    summaryCardSub: { fontSize: 13, fontFamily: FONT_REGULAR, marginTop: 2 },
    sectionTitle: { fontSize: 15, fontFamily: FONT_SEMIBOLD, marginBottom: 10, marginTop: 4 },
    orderItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 8, borderBottomWidth: 1,
    },
    orderItemQty: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    orderItemQtyText: { fontSize: 13, fontFamily: FONT_MEDIUM },
    orderItemName: { flex: 1, fontSize: 13, fontFamily: FONT_REGULAR },
    orderItemPrice: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
    couponRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
    couponInput: {
      flex: 1, height: 40, borderRadius: colors.radius,
      borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: FONT_REGULAR,
    },
    couponBtn: {
      paddingHorizontal: 16, height: 40,
      borderRadius: colors.radius, alignItems: 'center', justifyContent: 'center',
    },
    couponBtnText: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    couponApplied: { fontSize: 12, fontFamily: FONT_MEDIUM, marginTop: 16, marginBottom: 4 },
    priceBreakdown: { marginTop: 16, borderTopWidth: 1, paddingTop: 12 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    priceLabel: { fontSize: 14, fontFamily: FONT_REGULAR },
    priceValue: { fontSize: 14, fontFamily: FONT_MEDIUM },
    totalRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 6 },
    totalLabel: { fontSize: 16, fontFamily: FONT_BOLD },
    totalValue: { fontSize: 18, fontFamily: FONT_BOLD },
  });
}
