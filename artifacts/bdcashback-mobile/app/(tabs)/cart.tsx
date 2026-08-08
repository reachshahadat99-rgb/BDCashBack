import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, TextInput, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import {
  useGetCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
  useValidateCoupon,
  getGetCartQueryKey,
  type CartItem,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';
import { useCheckoutDraft } from '@/hooks/useCheckoutDraft';

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { hasDraft } = useCheckoutDraft();

  const { data: cart, isLoading, refetch } = useGetCart({ query: { enabled: !!isSignedIn, queryKey: getGetCartQueryKey() } });
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const validateCoupon = useValidateCoupon();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const styles = makeStyles(colors);

  const invalidateCart = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleUpdateQty = useCallback(
    (itemId: string, qty: number) => {
      if (qty < 1) return;
      Haptics.selectionAsync();
      updateItem.mutate({ itemId, data: { quantity: qty } }, { onSuccess: invalidateCart });
    },
    [updateItem, invalidateCart],
  );

  const handleRemove = useCallback(
    (itemId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      removeItem.mutate({ itemId }, { onSuccess: invalidateCart });
    },
    [removeItem, invalidateCart],
  );

  const handleApplyCoupon = useCallback(() => {
    if (!couponCode.trim()) return;
    validateCoupon.mutate(
      { data: { code: couponCode.trim().toUpperCase(), subtotal: cart?.subtotal ?? 0 } },
      {
        onSuccess: (result) => {
          if (result.valid) {
            setAppliedCoupon(couponCode.trim().toUpperCase());
            setCouponDiscount(result.discountAmount);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Alert.alert('Invalid Coupon', result.reason ?? 'Coupon is not valid.');
          }
        },
        onError: () => Alert.alert('Error', 'Could not validate coupon.'),
      },
    );
  }, [couponCode, cart?.subtotal, validateCoupon]);

  const handleCheckout = useCallback(() => {
    if (!cart?.items.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to the multi-step checkout screen, passing the coupon state so
    // the review step can pre-populate it.
    router.push({
      pathname: '/checkout',
      params: {
        couponCode: appliedCoupon ?? '',
        couponDiscount: String(couponDiscount),
      },
    });
  }, [cart, appliedCoupon, couponDiscount, router]);

  if (!isSignedIn) {
    return (
      <View style={[styles.authGate, { backgroundColor: colors.background, paddingTop: topInset + 40 }]}>
        <Feather name="shopping-cart" size={56} color={colors.mutedForeground} />
        <Text style={[styles.authTitle, { color: colors.foreground }]}>Your cart is waiting</Text>
        <Text style={[styles.authSubtitle, { color: colors.mutedForeground }]}>
          Sign in to add products and place orders
        </Text>
        <TouchableOpacity
          style={[styles.signInBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(auth)/sign-in')}
          activeOpacity={0.85}
        >
          <Text style={[styles.signInBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const cashback = cart?.cashbackAmount ?? 0;
  const finalTotal = Math.max(0, subtotal - couponDiscount);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cart</Text>
        {items.length > 0 && (
          <TouchableOpacity
            onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => clearCart.mutate(undefined, { onSuccess: invalidateCart }) },
            ])}
          >
            <Text style={[styles.clearText, { color: colors.destructive }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCart}>
          <Feather name="shopping-cart" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Cart is empty</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Add products from the Shop tab</Text>
          <TouchableOpacity
            style={[styles.shopBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/')}
            activeOpacity={0.85}
          >
            <Text style={[styles.shopBtnText, { color: colors.primaryForeground }]}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, Platform.OS === 'web' ? { paddingBottom: 340 } : { paddingBottom: 300 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }: { item: CartItem }) => (
              <View style={[styles.cartItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Image source={item.imageUrl} style={styles.itemImage} contentFit="cover" transition={200} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
                  <Text style={[styles.itemPrice, { color: colors.foreground }]}>৳{item.price.toLocaleString()}</Text>
                  <Text style={[styles.itemCashback, { color: colors.primary }]}>
                    +৳{item.cashbackAmount.toFixed(2)} cashback
                  </Text>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, { borderColor: colors.border }]}
                      onPress={() => handleUpdateQty(item.id, item.quantity - 1)}
                    >
                      <Feather name="minus" size={14} color={colors.foreground} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: colors.foreground }]}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, { borderColor: colors.border }]}
                      onPress={() => handleUpdateQty(item.id, item.quantity + 1)}
                    >
                      <Feather name="plus" size={14} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(item.id)}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />

          {/* Sticky summary */}
          <View style={[styles.summary, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {/* Coupon */}
            <View style={styles.couponRow}>
              <TextInput
                style={[styles.couponInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Coupon code"
                placeholderTextColor={colors.mutedForeground}
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.couponBtn, { backgroundColor: colors.primary }]}
                onPress={handleApplyCoupon}
                disabled={validateCoupon.isPending}
              >
                {validateCoupon.isPending
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Text style={[styles.couponBtnText, { color: colors.primaryForeground }]}>Apply</Text>
                }
              </TouchableOpacity>
            </View>
            {appliedCoupon && (
              <Text style={[styles.couponApplied, { color: colors.primary }]}>
                ✓ {appliedCoupon} — saved ৳{couponDiscount.toFixed(2)}
              </Text>
            )}

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>৳{subtotal.toLocaleString()}</Text>
            </View>
            {couponDiscount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.primary }]}>Discount</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>−৳{couponDiscount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Cashback earned</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>+৳{cashback.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>৳{finalTotal.toLocaleString()}</Text>
            </View>

            {hasDraft && (
              <TouchableOpacity
                style={[styles.resumeBanner, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
                onPress={handleCheckout}
                activeOpacity={0.85}
              >
                <Feather name="clock" size={14} color={colors.primary} />
                <Text style={[styles.resumeText, { color: colors.primary }]}>Resume checkout — address already saved</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
              onPress={handleCheckout}
              disabled={!items.length}
              activeOpacity={0.85}
            >
              <Feather name="arrow-right-circle" size={18} color={colors.primaryForeground} />
              <Text style={[styles.checkoutBtnText, { color: colors.primaryForeground }]}>
                Proceed to Checkout · ৳{finalTotal.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    authGate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
    authTitle: { fontSize: 22, fontFamily: FONT_BOLD, textAlign: 'center', marginTop: 8 },
    authSubtitle: { fontSize: 15, fontFamily: FONT_REGULAR, textAlign: 'center' },
    signInBtn: {
      paddingVertical: 14,
      paddingHorizontal: 40,
      borderRadius: colors.radius,
      marginTop: 8,
    },
    signInBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 24, fontFamily: FONT_BOLD },
    clearText: { fontSize: 14, fontFamily: FONT_MEDIUM },
    emptyCart: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 10,
    },
    emptyTitle: { fontSize: 20, fontFamily: FONT_BOLD, marginTop: 8 },
    emptySubtitle: { fontSize: 14, fontFamily: FONT_REGULAR, textAlign: 'center' },
    shopBtn: {
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: colors.radius,
      marginTop: 8,
    },
    shopBtnText: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    list: { paddingHorizontal: 16, paddingTop: 12 },
    cartItem: {
      flexDirection: 'row',
      borderRadius: colors.radius,
      borderWidth: 1,
      marginBottom: 12,
      overflow: 'hidden',
    },
    itemImage: { width: 90, height: 100 },
    itemInfo: { flex: 1, padding: 10, gap: 3 },
    itemName: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
    itemPrice: { fontSize: 15, fontFamily: FONT_BOLD },
    itemCashback: { fontSize: 11, fontFamily: FONT_MEDIUM },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    qtyBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyText: { fontSize: 15, fontFamily: FONT_SEMIBOLD, minWidth: 24, textAlign: 'center' },
    removeBtn: { marginLeft: 'auto' },
    summary: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      borderTopWidth: 1,
      paddingBottom: Platform.OS === 'web' ? 50 : 32,
    },
    couponRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    couponInput: {
      flex: 1,
      height: 40,
      borderRadius: colors.radius,
      borderWidth: 1,
      paddingHorizontal: 12,
      fontSize: 14,
      fontFamily: FONT_REGULAR,
    },
    couponBtn: {
      paddingHorizontal: 16,
      height: 40,
      borderRadius: colors.radius,
      alignItems: 'center',
      justifyContent: 'center',
    },
    couponBtnText: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    couponApplied: { fontSize: 12, fontFamily: FONT_MEDIUM, marginBottom: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    summaryLabel: { fontSize: 14, fontFamily: FONT_REGULAR },
    summaryValue: { fontSize: 14, fontFamily: FONT_MEDIUM },
    totalRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, marginBottom: 12 },
    totalLabel: { fontSize: 16, fontFamily: FONT_BOLD },
    totalValue: { fontSize: 18, fontFamily: FONT_BOLD },
    checkoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      borderRadius: colors.radius,
    },
    checkoutBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
    resumeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: colors.radius - 2,
      borderWidth: 1,
      marginBottom: 8,
    },
    resumeText: { fontSize: 12, fontFamily: FONT_MEDIUM, flex: 1 },
  });
}
