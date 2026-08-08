import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import {
  useAddCartItem,
  getGetCartQueryKey,
  type MarketplaceProduct,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useLocalSearchParams<{ id: string; data: string }>();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const product: MarketplaceProduct | null = React.useMemo(() => {
    try { return JSON.parse(data as string) as MarketplaceProduct; } catch { return null; }
  }, [data]);

  const addCartItem = useAddCartItem();
  const styles = makeStyles(colors);

  const handleAddToCart = useCallback(() => {
    if (!isSignedIn) {
      router.push('/(auth)/sign-in');
      return;
    }
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addCartItem.mutate(
      { data: { productId: product.id, quantity } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          setAdded(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => setAdded(false), 2000);
        },
        onError: (err: unknown) => {
          const msg = err && typeof err === 'object' && 'error' in err
            ? String((err as any).error)
            : 'Could not add to cart.';
          Alert.alert('Error', msg);
        },
      },
    );
  }, [isSignedIn, product, quantity, addCartItem, queryClient, router]);

  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Product not found</Text>
      </View>
    );
  }

  const savings = product.originalPrice - product.price;
  const savingsPercent = Math.round((savings / product.originalPrice) * 100);
  const cashbackAmount = (product.price * product.cashbackPercent * quantity) / 100;

  return (
    <>
      <Stack.Screen options={{ headerTitle: product.name, headerBackTitle: 'Shop' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          Platform.OS === 'web' ? { paddingBottom: 140 } : { paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={styles.imageContainer}>
          <Image source={product.image} style={styles.productImage} contentFit="cover" transition={300} />
          {product.badge && (
            <View style={[styles.heroBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.heroBadgeText, { color: colors.secondaryForeground }]}>{product.badge}</Text>
            </View>
          )}
          {savingsPercent > 0 && (
            <View style={[styles.savingsBadge, { backgroundColor: colors.destructive }]}>
              <Text style={styles.savingsBadgeText}>−{savingsPercent}%</Text>
            </View>
          )}
        </View>

        <View style={styles.details}>
          {/* Brand + name */}
          <Text style={[styles.brand, { color: colors.mutedForeground }]}>{product.brand} · {product.merchant}</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{product.name}</Text>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color={colors.secondary} />
            <Text style={[styles.rating, { color: colors.foreground }]}>{product.rating.toFixed(1)}</Text>
            <Text style={[styles.reviews, { color: colors.mutedForeground }]}>({product.reviewCount} reviews)</Text>
          </View>

          {/* Prices */}
          <View style={styles.priceBlock}>
            <Text style={[styles.price, { color: colors.foreground }]}>৳{product.price.toLocaleString()}</Text>
            {savings > 0 && (
              <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>
                ৳{product.originalPrice.toLocaleString()}
              </Text>
            )}
            {savings > 0 && (
              <View style={[styles.savingsPill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.savingsText, { color: colors.primary }]}>Save ৳{savings.toLocaleString()}</Text>
              </View>
            )}
          </View>

          {/* Cashback highlight */}
          <LinearGradient
            colors={[colors.accent, colors.background]}
            style={[styles.cashbackCard, { borderColor: colors.border }]}
          >
            <Feather name="gift" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cashbackTitle, { color: colors.primary }]}>
                {product.cashbackPercent}% Cashback
              </Text>
              <Text style={[styles.cashbackSub, { color: colors.accentForeground }]}>
                Earn ৳{cashbackAmount.toFixed(2)} on this purchase
              </Text>
            </View>
          </LinearGradient>

          {/* Category */}
          <View style={styles.infoRow}>
            <Feather name="tag" size={15} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{product.category}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        paddingBottom: Platform.OS === 'web' ? 50 : Math.max(insets.bottom, 20),
      }]}>
        {/* Quantity */}
        <View style={styles.qtyControl}>
          <TouchableOpacity
            style={[styles.qtyBtn, { borderColor: colors.border }]}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Feather name="minus" size={16} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.qtyText, { color: colors.foreground }]}>{quantity}</Text>
          <TouchableOpacity
            style={[styles.qtyBtn, { borderColor: colors.border }]}
            onPress={() => setQuantity((q) => q + 1)}
          >
            <Feather name="plus" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: added ? colors.accent : colors.primary }]}
          onPress={handleAddToCart}
          disabled={addCartItem.isPending || added}
          activeOpacity={0.85}
        >
          {addCartItem.isPending
            ? <ActivityIndicator color={added ? colors.primary : colors.primaryForeground} />
            : added
              ? (
                <>
                  <Feather name="check" size={18} color={colors.primary} />
                  <Text style={[styles.addBtnText, { color: colors.primary }]}>Added!</Text>
                </>
              )
              : (
                <>
                  <Feather name="shopping-cart" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add to Cart</Text>
                </>
              )
          }
        </TouchableOpacity>
      </View>
    </>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 15, fontFamily: FONT_MEDIUM },
    imageContainer: { position: 'relative' },
    productImage: { width: '100%', aspectRatio: 1.2, backgroundColor: colors.muted },
    heroBadge: {
      position: 'absolute',
      top: 16,
      left: 16,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    heroBadgeText: { fontSize: 12, fontFamily: FONT_SEMIBOLD },
    savingsBadge: {
      position: 'absolute',
      top: 16,
      right: 16,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    savingsBadgeText: { fontSize: 12, fontFamily: FONT_BOLD, color: '#FFFFFF' },
    details: { padding: 20, gap: 10 },
    brand: { fontSize: 13, fontFamily: FONT_REGULAR },
    name: { fontSize: 22, fontFamily: FONT_BOLD, lineHeight: 28 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rating: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    reviews: { fontSize: 13, fontFamily: FONT_REGULAR },
    priceBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    price: { fontSize: 28, fontFamily: FONT_BOLD },
    originalPrice: { fontSize: 16, fontFamily: FONT_REGULAR, textDecorationLine: 'line-through' },
    savingsPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    savingsText: { fontSize: 12, fontFamily: FONT_SEMIBOLD },
    cashbackCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: colors.radius,
      borderWidth: 1,
      padding: 14,
      marginTop: 4,
    },
    cashbackTitle: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    cashbackSub: { fontSize: 12, fontFamily: FONT_REGULAR, marginTop: 2 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    infoText: { fontSize: 13, fontFamily: FONT_REGULAR },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
    },
    qtyControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    qtyBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyText: { fontSize: 17, fontFamily: FONT_BOLD, minWidth: 28, textAlign: 'center' },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: colors.radius,
    },
    addBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
  });
}
