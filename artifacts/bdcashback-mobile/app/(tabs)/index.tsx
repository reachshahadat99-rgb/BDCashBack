import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import {
  useGetMarketplaceSummary,
  useListMarketplaceProducts,
  useGetWalletSummary,
  useAddCartItem,
  getGetCartQueryKey,
  getGetWalletSummaryQueryKey,
  type MarketplaceProduct,
  type MarketplaceCategory,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

export default function ShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } =
    useGetMarketplaceSummary();
  const { data: walletData } = useGetWalletSummary({ query: { enabled: !!isSignedIn, queryKey: getGetWalletSummaryQueryKey() } });
  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useListMarketplaceProducts(
    { category: selectedCategory, search: search || undefined },
  );

  const addCartItem = useAddCartItem();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchProducts()]);
    setRefreshing(false);
  }, [refetchSummary, refetchProducts]);

  const handleAddToCart = useCallback(
    (product: MarketplaceProduct) => {
      if (!isSignedIn) {
        router.push('/(auth)/sign-in');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addCartItem.mutate(
        { data: { productId: product.id, quantity: 1 } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      );
    },
    [isSignedIn, router, addCartItem, queryClient],
  );

  const categories: MarketplaceCategory[] = summary?.categories ?? [];
  const displayProducts: MarketplaceProduct[] = products ?? summary?.featuredProducts ?? [];
  const isLoading = summaryLoading && !summary;

  const styles = makeStyles(colors);

  const renderProduct = useCallback(
    ({ item, index }: { item: MarketplaceProduct; index: number }) => (
      <Pressable
        style={[styles.productCard, index % 2 === 0 ? { marginRight: 6 } : { marginLeft: 6 }]}
        onPress={() =>
          router.push({
            pathname: '/product/[id]',
            params: { id: item.id, data: JSON.stringify(item) },
          })
        }
        android_ripple={{ color: colors.muted }}
      >
        <Image
          source={item.image}
          style={styles.productImage}
          contentFit="cover"
          transition={200}
        />
        {item.badge && (
          <View style={[styles.badgePill, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.badgePillText, { color: colors.secondaryForeground }]}>
              {item.badge}
            </Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productBrand} numberOfLines={1}>{item.brand}</Text>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>৳{item.price.toLocaleString()}</Text>
            {item.originalPrice > item.price && (
              <Text style={styles.originalPrice}>৳{item.originalPrice.toLocaleString()}</Text>
            )}
          </View>
          <View style={styles.cashbackRow}>
            <LinearGradient
              colors={[colors.primary, `${colors.primary}CC`]}
              start={[0, 0]} end={[1, 0]}
              style={styles.cashbackBadge}
            >
              <Text style={styles.cashbackText}>{item.cashbackPercent}% cashback</Text>
            </LinearGradient>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleAddToCart(item)}
            activeOpacity={0.8}
          >
            <Feather name="shopping-cart" size={14} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    ),
    [colors, router, handleAddToCart, styles],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.logoText}>BD<Text style={[styles.logoAccent, { color: colors.secondary }]}>Cashback</Text></Text>
            {isSignedIn && walletData && (
              <Text style={[styles.walletChip, { color: colors.mutedForeground }]}>
                Balance: <Text style={{ color: colors.primary, fontFamily: FONT_SEMIBOLD }}>৳{walletData.availableCashback.toFixed(0)}</Text>
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.muted }]}
              onPress={() => setSearchOpen((v) => !v)}
            >
              <Feather name={searchOpen ? 'x' : 'search'} size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {searchOpen && (
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Search products..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <FlatList
            data={[{ id: '', name: 'All', icon: '🏪', productCount: 0 }, ...categories]}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoriesScroll}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: selectedCategory === (item.id || undefined)
                      ? colors.primary
                      : colors.muted,
                    borderColor: selectedCategory === (item.id || undefined)
                      ? colors.primary
                      : colors.border,
                  },
                ]}
                onPress={() => setSelectedCategory(item.id || undefined)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: selectedCategory === (item.id || undefined)
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Products */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : summaryError && !summary ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Couldn't load the shop</Text>
          <Text style={[styles.errorSubtitle, { color: colors.mutedForeground }]}>
            Check your connection and try again
          </Text>
          <TouchableOpacity
            onPress={() => { refetchSummary(); refetchProducts(); }}
            style={[styles.retryBtn, { borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <Feather name="refresh-cw" size={14} color={colors.primary} />
            <Text style={[styles.retryBtnText, { color: colors.primary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : productsError ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Failed to load products</Text>
          <TouchableOpacity
            onPress={() => refetchProducts()}
            style={[styles.retryBtn, { borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <Feather name="refresh-cw" size={14} color={colors.primary} />
            <Text style={[styles.retryBtnText, { color: colors.primary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[
            styles.productList,
            Platform.OS === 'web' ? { paddingBottom: 100 } : { paddingBottom: 120 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!displayProducts.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="package" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No products found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    logoText: {
      fontSize: 22,
      fontFamily: FONT_BOLD,
      color: colors.foreground,
    },
    logoAccent: {
      fontFamily: FONT_BOLD,
    },
    walletChip: {
      fontSize: 12,
      fontFamily: FONT_REGULAR,
      marginTop: 2,
    },
    headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    headerBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchInput: {
      height: 40,
      borderRadius: colors.radius,
      borderWidth: 1,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: FONT_REGULAR,
      marginTop: 8,
      marginBottom: 4,
    },
    categoriesScroll: { paddingVertical: 10, gap: 8, paddingRight: 16 },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    categoryText: { fontSize: 13, fontFamily: FONT_MEDIUM },
    productList: { paddingHorizontal: 12, paddingTop: 12 },
    productCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: 'hidden',
    },
    productImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.muted },
    badgePill: {
      position: 'absolute',
      top: 8,
      left: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    badgePillText: { fontSize: 10, fontFamily: FONT_SEMIBOLD },
    productInfo: { padding: 10 },
    productBrand: { fontSize: 11, fontFamily: FONT_MEDIUM, color: colors.mutedForeground },
    productName: { fontSize: 13, fontFamily: FONT_SEMIBOLD, color: colors.foreground, marginTop: 2 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    price: { fontSize: 15, fontFamily: FONT_BOLD, color: colors.foreground },
    originalPrice: {
      fontSize: 12,
      fontFamily: FONT_REGULAR,
      color: colors.mutedForeground,
      textDecorationLine: 'line-through',
    },
    cashbackRow: { marginTop: 6 },
    cashbackBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    cashbackText: { fontSize: 10, fontFamily: FONT_SEMIBOLD, color: '#FFFFFF' },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 8,
      paddingVertical: 8,
      borderRadius: colors.radius - 2,
    },
    addBtnText: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 15, fontFamily: FONT_MEDIUM },
    errorTitle: { fontSize: 18, fontFamily: FONT_BOLD, textAlign: 'center', color: colors.foreground },
    errorSubtitle: { fontSize: 14, fontFamily: FONT_REGULAR, textAlign: 'center', paddingHorizontal: 32, color: colors.mutedForeground },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: colors.radius,
      paddingHorizontal: 20,
      paddingVertical: 9,
    },
    retryBtnText: { fontSize: 14, fontFamily: FONT_SEMIBOLD, color: colors.primary },
  });
}
