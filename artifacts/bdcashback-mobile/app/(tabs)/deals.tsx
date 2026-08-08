import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  ActivityIndicator, Pressable, RefreshControl, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  useListPromoDeals,
  useListGroupBuyDeals,
  useListPublicCoupons,
  type PromoDeal,
  type GroupBuyDeal,
  type Coupon,
} from '@workspace/api-client-react';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  const hrs = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hrs}h left`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hrs}h ${mins}m left`;
}

export default function DealsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: promoDeals, isLoading: promoLoading, refetch: refetchPromo } = useListPromoDeals();
  const { data: groupBuys, isLoading: groupLoading, refetch: refetchGroup } = useListGroupBuyDeals();
  const { data: coupons, isLoading: couponsLoading, refetch: refetchCoupons } = useListPublicCoupons();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const isLoading = promoLoading && groupLoading && couponsLoading;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPromo(), refetchGroup(), refetchCoupons()]);
    setRefreshing(false);
  }, [refetchPromo, refetchGroup, refetchCoupons]);

  const handleCopyCoupon = (code: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', `Coupon code "${code}" is ready to use at checkout.`);
  };

  const styles = makeStyles(colors);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        Platform.OS === 'web'
          ? { paddingTop: topInset + 16, paddingBottom: 100 }
          : { paddingTop: topInset + 16, paddingBottom: 120 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Deals & Offers</Text>

      {/* Promo Deals */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Flash Deals</Text>
        {promoLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (promoDeals?.length ?? 0) === 0 ? (
          <View style={styles.emptySection}>
            <Feather name="zap" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No flash deals right now</Text>
          </View>
        ) : (
          <FlatList
            data={promoDeals}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingRight: 16 }}
            scrollEnabled={!!promoDeals?.length}
            renderItem={({ item }) => (
              <Pressable style={[styles.dealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Image source={item.imageUrl} style={styles.dealImage} contentFit="cover" transition={200} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.dealGradient}
                />
                <View style={styles.dealOverlay}>
                  <View style={[styles.discountBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.discountText, { color: colors.secondaryForeground }]}>
                      {item.discountPercent}% OFF
                    </Text>
                  </View>
                  <Text style={styles.dealTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.dealStoreName}>{item.storeName}</Text>
                  <Text style={styles.dealTimer}>{timeLeft(item.endsAt)}</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Group Buys */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Group Buys</Text>
        {groupLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (groupBuys?.filter((d) => d.status === 'open').length ?? 0) === 0 ? (
          <View style={styles.emptySection}>
            <Feather name="users" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No group buys open</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {(groupBuys ?? [])
              .filter((d) => d.status === 'open')
              .map((deal) => {
                const progress = Math.min(1, deal.joinedCount / deal.minParticipants);
                const depositAmt = Math.round((deal.groupPrice * deal.depositPercent) / 100);
                return (
                  <Pressable
                    key={deal.id}
                    style={[styles.groupBuyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() =>
                      router.push({
                        pathname: '/group-buy/[id]',
                        params: { id: deal.id, data: JSON.stringify(deal) },
                      })
                    }
                  >
                    <Image source={deal.image} style={styles.groupBuyImage} contentFit="cover" transition={200} />
                    <View style={styles.groupBuyInfo}>
                      <Text style={[styles.groupBuyTitle, { color: colors.foreground }]} numberOfLines={2}>
                        {deal.title}
                      </Text>
                      <View style={styles.priceRow}>
                        <Text style={[styles.groupPrice, { color: colors.primary }]}>৳{deal.groupPrice.toLocaleString()}</Text>
                        <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>৳{deal.originalPrice.toLocaleString()}</Text>
                      </View>
                      <View style={styles.statsRow}>
                        <View style={[styles.statBadge, { backgroundColor: colors.accent }]}>
                          <Text style={[styles.statText, { color: colors.accentForeground }]}>
                            {deal.cashbackPercent}% cashback
                          </Text>
                        </View>
                        <Text style={[styles.depositText, { color: colors.mutedForeground }]}>
                          Deposit: ৳{depositAmt}
                        </Text>
                      </View>
                      {/* Progress bar */}
                      <View style={[styles.progressBg, { backgroundColor: colors.muted }]}>
                        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: colors.primary }]} />
                      </View>
                      <View style={styles.participantRow}>
                        <Ionicons name="people" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.participantText, { color: colors.mutedForeground }]}>
                          {deal.joinedCount}/{deal.minParticipants} joined · {timeLeft(deal.endsAt)}
                        </Text>
                      </View>
                      {deal.myOrder ? (
                        <View style={[styles.joinedBadge, { backgroundColor: colors.accent }]}>
                          <Feather name="check" size={12} color={colors.primary} />
                          <Text style={[styles.joinedText, { color: colors.primary }]}>You're in!</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.joinBtn, { backgroundColor: colors.primary }]}
                          onPress={() =>
                            router.push({
                              pathname: '/group-buy/[id]',
                              params: { id: deal.id, data: JSON.stringify(deal) },
                            })
                          }
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.joinBtnText, { color: colors.primaryForeground }]}>Join Group</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Pressable>
                );
              })}
          </View>
        )}
      </View>

      {/* Coupons */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Coupons</Text>
        {couponsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (coupons?.length ?? 0) === 0 ? (
          <View style={styles.emptySection}>
            <Feather name="scissors" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active coupons</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {(coupons ?? []).map((coupon) => (
              <View key={coupon.id} style={[styles.couponCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.couponLeft, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.couponValue, { color: colors.primary }]}>
                    {coupon.discountType === 'percent' ? `${coupon.discountValue}%` : `৳${coupon.discountValue}`}
                  </Text>
                  <Text style={[styles.couponOff, { color: colors.accentForeground }]}>OFF</Text>
                </View>
                <View style={styles.couponInfo}>
                  <Text style={[styles.couponTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {coupon.title}
                  </Text>
                  <Text style={[styles.couponMeta, { color: colors.mutedForeground }]}>
                    {coupon.minOrderValue > 0 ? `Min order ৳${coupon.minOrderValue}` : 'No minimum'} · {timeLeft(coupon.endsAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleCopyCoupon(coupon.code)}
                >
                  <Feather name="copy" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.copyBtnText, { color: colors.primaryForeground }]}>{coupon.code}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 16 },
    pageTitle: { fontSize: 26, fontFamily: FONT_BOLD, marginBottom: 20 },
    section: { marginBottom: 28 },
    sectionTitle: { fontSize: 18, fontFamily: FONT_BOLD, marginBottom: 14 },
    emptySection: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    emptyText: { fontSize: 14, fontFamily: FONT_MEDIUM },
    // Promo deal cards
    dealCard: {
      width: 220,
      height: 160,
      borderRadius: colors.radius,
      overflow: 'hidden',
      borderWidth: 1,
    },
    dealImage: { ...StyleSheet.absoluteFillObject },
    dealGradient: { ...StyleSheet.absoluteFillObject },
    dealOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
    discountBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      marginBottom: 4,
    },
    discountText: { fontSize: 11, fontFamily: FONT_BOLD },
    dealTitle: { fontSize: 13, fontFamily: FONT_SEMIBOLD, color: '#FFFFFF' },
    dealStoreName: { fontSize: 11, fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    dealTimer: { fontSize: 11, fontFamily: FONT_MEDIUM, color: colors.secondary, marginTop: 2 },
    // Group buy cards
    groupBuyCard: {
      flexDirection: 'row',
      borderRadius: colors.radius,
      borderWidth: 1,
      overflow: 'hidden',
    },
    groupBuyImage: { width: 100, height: 130 },
    groupBuyInfo: { flex: 1, padding: 10, gap: 4 },
    groupBuyTitle: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    groupPrice: { fontSize: 16, fontFamily: FONT_BOLD },
    originalPrice: { fontSize: 12, fontFamily: FONT_REGULAR, textDecorationLine: 'line-through' },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    statBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    statText: { fontSize: 11, fontFamily: FONT_SEMIBOLD },
    depositText: { fontSize: 11, fontFamily: FONT_REGULAR },
    progressBg: { height: 4, borderRadius: 2, marginTop: 4 },
    progressFill: { height: 4, borderRadius: 2 },
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    participantText: { fontSize: 11, fontFamily: FONT_REGULAR },
    joinedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: colors.radius - 2,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    joinedText: { fontSize: 12, fontFamily: FONT_SEMIBOLD },
    joinBtn: {
      alignItems: 'center',
      paddingVertical: 7,
      borderRadius: colors.radius - 2,
      marginTop: 4,
    },
    joinBtnText: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
    // Coupons
    couponCard: {
      flexDirection: 'row',
      borderRadius: colors.radius,
      borderWidth: 1,
      overflow: 'hidden',
      alignItems: 'center',
    },
    couponLeft: {
      width: 72,
      paddingVertical: 16,
      alignItems: 'center',
    },
    couponValue: { fontSize: 18, fontFamily: FONT_BOLD },
    couponOff: { fontSize: 11, fontFamily: FONT_MEDIUM, marginTop: -2 },
    couponInfo: { flex: 1, paddingHorizontal: 12 },
    couponTitle: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
    couponMeta: { fontSize: 11, fontFamily: FONT_REGULAR, marginTop: 3 },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      margin: 10,
      borderRadius: colors.radius - 2,
    },
    copyBtnText: { fontSize: 11, fontFamily: FONT_BOLD },
  });
}
