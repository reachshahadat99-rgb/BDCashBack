import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import {
  useJoinGroupBuyDeal,
  getListGroupBuyDealsQueryKey,
  type GroupBuyDeal,
  type GroupBuyOrder,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

type PayMethod = 'bkash' | 'nagad' | 'card';

const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'card', label: 'Card' },
];

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  const hrs = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hrs}h left`;
  return `${hrs}h ${Math.floor((diff % 3_600_000) / 60_000)}m left`;
}

export default function GroupBuyDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useLocalSearchParams<{ id: string; data: string }>();

  const deal: GroupBuyDeal | null = React.useMemo(() => {
    try { return JSON.parse(data as string) as GroupBuyDeal; } catch { return null; }
  }, [data]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [payMethod, setPayMethod] = useState<PayMethod>('bkash');
  const [confirmedOrder, setConfirmedOrder] = useState<GroupBuyOrder | null>(null);

  const joinDeal = useJoinGroupBuyDeal();
  const styles = makeStyles(colors);

  const handleJoin = useCallback(() => {
    if (!isSignedIn) { router.push('/(auth)/sign-in'); return; }
    if (!deal) return;
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Fill all fields', 'Please fill in all required fields.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    joinDeal.mutate(
      { id: deal.id, data: { fullName: fullName.trim(), phone: phone.trim(), address: address.trim(), quantity, paymentMethod: payMethod } },
      {
        onSuccess: (order) => {
          setConfirmedOrder(order);
          queryClient.invalidateQueries({ queryKey: getListGroupBuyDealsQueryKey() });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err: unknown) => {
          const msg = err && typeof err === 'object' && 'error' in err
            ? String((err as any).error)
            : 'Could not join. Please try again.';
          Alert.alert('Error', msg);
        },
      },
    );
  }, [isSignedIn, deal, fullName, phone, address, quantity, payMethod, joinDeal, queryClient, router]);

  if (!deal) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Deal not found</Text>
      </View>
    );
  }

  const totalAmt = deal.groupPrice * quantity;
  const depositAmt = Math.round((totalAmt * deal.depositPercent) / 100);
  const dueAmt = totalAmt - depositAmt;
  const progress = Math.min(1, deal.joinedCount / deal.minParticipants);

  if (confirmedOrder) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <Stack.Screen options={{ headerTitle: 'Order Confirmed' }} />
        <LinearGradient colors={[colors.accent, colors.background]} style={styles.successCard}>
          <View style={[styles.successIcon, { backgroundColor: colors.primary }]}>
            <Feather name="check" size={32} color="#FFFFFF" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>You're in!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Your spot in {deal.title} is reserved
          </Text>

          <View style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: 'Reference', value: confirmedOrder.paymentRef ?? '—' },
              { label: 'Quantity', value: String(confirmedOrder.quantity) },
              { label: 'Deposit paid', value: `৳${confirmedOrder.depositPaid.toFixed(2)}` },
              { label: 'Due on completion', value: `৳${confirmedOrder.dueAmount.toFixed(2)}` },
            ].map((row) => (
              <View key={row.label} style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.receiptValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.successNote, { color: colors.mutedForeground }]}>
            Balance collected once the group reaches {deal.minParticipants} participants.
          </Text>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/deals')}
            activeOpacity={0.85}
          >
            <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Back to Deals</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerTitle: deal.title }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          Platform.OS === 'web' ? { paddingBottom: 100 } : { paddingBottom: 40 + Math.max(insets.bottom, 20) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Deal image */}
        <Image source={deal.image} style={styles.heroImage} contentFit="cover" transition={200} />

        <View style={styles.body}>
          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.accent }]}>
              <Text style={[styles.statVal, { color: colors.primary }]}>৳{deal.groupPrice.toLocaleString()}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Group Price</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.muted }]}>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{deal.cashbackPercent}%</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Cashback</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.muted }]}>
              <Text style={[styles.statVal, { color: colors.secondary }]}>{deal.depositPercent}%</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Deposit</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people" size={16} color={colors.primary} />
                <Text style={[styles.progressTitle, { color: colors.foreground }]}>
                  {deal.joinedCount} / {deal.minParticipants} joined
                </Text>
              </View>
              <Text style={[styles.timerText, { color: colors.secondary }]}>{timeLeft(deal.endsAt)}</Text>
            </View>
            <View style={[styles.progressBg, { backgroundColor: colors.muted }]}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.progressSub, { color: colors.mutedForeground }]}>
              {deal.minParticipants - deal.joinedCount} more needed to unlock group price
            </Text>
          </View>

          {deal.myOrder ? (
            <View style={[styles.alreadyJoined, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
              <Feather name="check-circle" size={20} color={colors.primary} />
              <Text style={[styles.alreadyJoinedText, { color: colors.primary }]}>
                You've already joined this group buy!
              </Text>
            </View>
          ) : deal.status !== 'open' ? (
            <View style={[styles.closedBanner, { backgroundColor: colors.muted }]}>
              <Text style={[styles.closedText, { color: colors.mutedForeground }]}>This deal is no longer open</Text>
            </View>
          ) : (
            /* Join form */
            <View style={[styles.joinForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Join this Group</Text>

              {/* Quantity */}
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Quantity</Text>
              <View style={styles.qtyRow}>
                {[1, 2, 3, 4, 5].map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.qtyPill, { backgroundColor: quantity === q ? colors.primary : colors.muted, borderColor: quantity === q ? colors.primary : colors.border }]}
                    onPress={() => setQuantity(q)}
                  >
                    <Text style={[styles.qtyPillText, { color: quantity === q ? colors.primaryForeground : colors.foreground }]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {[
                { label: 'Full Name', value: fullName, setter: setFullName, placeholder: 'Your full name' },
                { label: 'Phone', value: phone, setter: setPhone, placeholder: '01XXXXXXXXX' },
                { label: 'Delivery Address', value: address, setter: setAddress, placeholder: 'Full address for delivery' },
              ].map((field) => (
                <React.Fragment key={field.label}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{field.label}</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={field.value}
                    onChangeText={field.setter}
                  />
                </React.Fragment>
              ))}

              {/* Payment method */}
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Payment Method</Text>
              <View style={styles.payRow}>
                {PAY_METHODS.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.payPill, {
                      backgroundColor: payMethod === m.id ? colors.primary : colors.muted,
                      borderColor: payMethod === m.id ? colors.primary : colors.border,
                    }]}
                    onPress={() => setPayMethod(m.id)}
                  >
                    <Text style={[styles.payPillText, { color: payMethod === m.id ? colors.primaryForeground : colors.foreground }]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary */}
              <View style={[styles.summaryBox, { backgroundColor: colors.muted }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total ({quantity}×)</Text>
                  <Text style={[styles.summaryVal, { color: colors.foreground }]}>৳{totalAmt.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Deposit now</Text>
                  <Text style={[styles.summaryVal, { color: colors.primary, fontFamily: FONT_BOLD }]}>৳{depositAmt.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Due later</Text>
                  <Text style={[styles.summaryVal, { color: colors.foreground }]}>৳{dueAmt.toLocaleString()}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.joinBtn, { backgroundColor: joinDeal.isPending ? colors.mutedForeground : colors.primary }]}
                onPress={handleJoin}
                disabled={joinDeal.isPending}
                activeOpacity={0.85}
              >
                {joinDeal.isPending
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : (
                    <>
                      <Ionicons name="people" size={18} color={colors.primaryForeground} />
                      <Text style={[styles.joinBtnText, { color: colors.primaryForeground }]}>
                        Join · Pay ৳{depositAmt.toLocaleString()} Deposit
                      </Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 15, fontFamily: FONT_MEDIUM },
    heroImage: { width: '100%', aspectRatio: 1.6, backgroundColor: colors.muted },
    body: { padding: 16, gap: 16 },
    statsGrid: { flexDirection: 'row', gap: 10 },
    statBox: {
      flex: 1,
      borderRadius: colors.radius,
      padding: 12,
      alignItems: 'center',
      gap: 4,
    },
    statVal: { fontSize: 18, fontFamily: FONT_BOLD },
    statLbl: { fontSize: 11, fontFamily: FONT_REGULAR },
    progressCard: {
      borderRadius: colors.radius,
      borderWidth: 1,
      padding: 14,
      gap: 10,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressTitle: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    timerText: { fontSize: 12, fontFamily: FONT_SEMIBOLD },
    progressBg: { height: 8, borderRadius: 4 },
    progressFill: { height: 8, borderRadius: 4 },
    progressSub: { fontSize: 11, fontFamily: FONT_REGULAR },
    alreadyJoined: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: colors.radius,
      borderWidth: 1.5,
      padding: 14,
    },
    alreadyJoinedText: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    closedBanner: { borderRadius: colors.radius, padding: 14, alignItems: 'center' },
    closedText: { fontSize: 14, fontFamily: FONT_MEDIUM },
    joinForm: {
      borderRadius: colors.radius,
      borderWidth: 1,
      padding: 16,
      gap: 8,
    },
    formTitle: { fontSize: 18, fontFamily: FONT_BOLD, marginBottom: 4 },
    fieldLabel: { fontSize: 13, fontFamily: FONT_SEMIBOLD, marginTop: 4 },
    formInput: {
      height: 44,
      borderRadius: colors.radius - 2,
      borderWidth: 1,
      paddingHorizontal: 12,
      fontSize: 15,
      fontFamily: FONT_REGULAR,
    },
    qtyRow: { flexDirection: 'row', gap: 8 },
    qtyPill: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyPillText: { fontSize: 16, fontFamily: FONT_BOLD },
    payRow: { flexDirection: 'row', gap: 8 },
    payPill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: colors.radius - 2,
      borderWidth: 1.5,
      alignItems: 'center',
    },
    payPillText: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
    summaryBox: {
      borderRadius: colors.radius - 2,
      padding: 12,
      gap: 6,
      marginTop: 4,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { fontSize: 13, fontFamily: FONT_REGULAR },
    summaryVal: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: colors.radius,
      marginTop: 4,
    },
    joinBtnText: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    // Success screen
    successContainer: { flex: 1, padding: 20, justifyContent: 'center' },
    successCard: {
      borderRadius: colors.radius + 4,
      padding: 24,
      alignItems: 'center',
      gap: 12,
    },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: { fontSize: 28, fontFamily: FONT_BOLD },
    successSub: { fontSize: 15, fontFamily: FONT_REGULAR, textAlign: 'center' },
    receiptCard: {
      width: '100%',
      borderRadius: colors.radius,
      borderWidth: 1,
      padding: 14,
      gap: 8,
    },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
    receiptLabel: { fontSize: 13, fontFamily: FONT_REGULAR },
    receiptValue: { fontSize: 13, fontFamily: FONT_SEMIBOLD },
    successNote: { fontSize: 12, fontFamily: FONT_REGULAR, textAlign: 'center' },
    doneBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: colors.radius,
      alignItems: 'center',
    },
    doneBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
  });
}
