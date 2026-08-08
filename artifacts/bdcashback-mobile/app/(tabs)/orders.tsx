import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import {
  useListOrders,
  useCancelOrder,
  getListOrdersQueryKey,
  type CustomerOrder,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  processing: { bg: '#DBEAFE', text: '#1E40AF' },
  shipped: { bg: '#D1FAE5', text: '#065F46' },
  delivered: { bg: '#D1FAE5', text: '#065F46' },
  completed: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: orders, isLoading, refetch } = useListOrders({ query: { enabled: !!isSignedIn, queryKey: getListOrdersQueryKey() } });
  const cancelOrder = useCancelOrder();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const styles = makeStyles(colors);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCancel = useCallback(
    (orderId: string) => {
      Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            cancelOrder.mutate(
              { id: orderId },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                },
                onError: (err: unknown) => {
                  const msg =
                    err && typeof err === 'object' && 'error' in err
                      ? String((err as any).error)
                      : 'Could not cancel the order.';
                  Alert.alert('Error', msg);
                },
              },
            );
          },
        },
      ]);
    },
    [cancelOrder, queryClient],
  );

  if (!isSignedIn) {
    return (
      <View style={[styles.authGate, { backgroundColor: colors.background, paddingTop: topInset + 40 }]}>
        <Feather name="list" size={56} color={colors.mutedForeground} />
        <Text style={[styles.authTitle, { color: colors.foreground }]}>Track your orders</Text>
        <Text style={[styles.authSubtitle, { color: colors.mutedForeground }]}>
          Sign in to view your order history
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Orders</Text>
      </View>

      <FlatList
        data={orders ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          Platform.OS === 'web' ? { paddingBottom: 100 } : { paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={56} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No orders yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Your orders will appear here after checkout
            </Text>
            <TouchableOpacity
              style={[styles.shopBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/')}
              activeOpacity={0.85}
            >
              <Text style={[styles.shopBtnText, { color: colors.primaryForeground }]}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }: { item: CustomerOrder }) => {
          const statusColor = STATUS_COLORS[item.status] ?? { bg: colors.muted, text: colors.mutedForeground };
          const canCancel = ['pending', 'processing'].includes(item.status);
          return (
            <View style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={[styles.orderId, { color: colors.mutedForeground }]}>
                    #{item.id.slice(-8).toUpperCase()}
                  </Text>
                  <Text style={[styles.orderDate, { color: colors.mutedForeground }]}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                  <Text style={[styles.statusText, { color: statusColor.text }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.orderMeta}>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Items</Text>
                  <Text style={[styles.metaValue, { color: colors.foreground }]}>{item.itemsCount}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Total</Text>
                  <Text style={[styles.metaValue, { color: colors.foreground }]}>৳{item.total.toLocaleString()}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Cashback</Text>
                  <Text style={[styles.metaValue, { color: colors.primary }]}>+৳{item.cashbackAmount.toFixed(2)}</Text>
                </View>
              </View>

              {item.couponCode && (
                <Text style={[styles.couponApplied, { color: colors.mutedForeground }]}>
                  Coupon: {item.couponCode} (−৳{item.discountAmount.toFixed(2)})
                </Text>
              )}

              {canCancel && (
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.destructive }]}
                  onPress={() => handleCancel(item.id)}
                  disabled={cancelOrder.isPending}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.destructive }]}>Cancel Order</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    authGate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
    authTitle: { fontSize: 22, fontFamily: FONT_BOLD, textAlign: 'center', marginTop: 8 },
    authSubtitle: { fontSize: 15, fontFamily: FONT_REGULAR, textAlign: 'center' },
    signInBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: colors.radius, marginTop: 8 },
    signInBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 24, fontFamily: FONT_BOLD },
    list: { paddingHorizontal: 16, paddingTop: 12 },
    emptyState: {
      paddingTop: 60,
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 32,
    },
    emptyTitle: { fontSize: 20, fontFamily: FONT_BOLD, marginTop: 8 },
    emptySubtitle: { fontSize: 14, fontFamily: FONT_REGULAR, textAlign: 'center' },
    shopBtn: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: colors.radius, marginTop: 8 },
    shopBtnText: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    orderCard: {
      borderRadius: colors.radius,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    orderId: { fontSize: 12, fontFamily: FONT_BOLD },
    orderDate: { fontSize: 12, fontFamily: FONT_REGULAR, marginTop: 2 },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: { fontSize: 12, fontFamily: FONT_SEMIBOLD },
    divider: { height: 1, marginVertical: 12 },
    orderMeta: { flexDirection: 'row', justifyContent: 'space-around' },
    metaItem: { alignItems: 'center', gap: 2 },
    metaLabel: { fontSize: 11, fontFamily: FONT_REGULAR },
    metaValue: { fontSize: 14, fontFamily: FONT_BOLD },
    couponApplied: { fontSize: 11, fontFamily: FONT_REGULAR, marginTop: 8 },
    cancelBtn: {
      borderWidth: 1,
      borderRadius: colors.radius - 2,
      paddingVertical: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    cancelBtnText: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
  });
}
