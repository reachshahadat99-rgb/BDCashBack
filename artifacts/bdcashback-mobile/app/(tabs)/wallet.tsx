import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, TextInput, Alert, ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth, useUser } from '@clerk/expo';
import {
  useGetWalletSummary,
  useListWalletTransactions,
  useRequestWithdrawal,
  getGetWalletSummaryQueryKey,
  getListWalletTransactionsQueryKey,
  type WalletTransaction,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

const TX_ICONS: Record<string, string> = {
  credit: 'arrow-down-left',
  debit: 'arrow-up-right',
  cashback: 'gift',
  withdrawal: 'send',
  refund: 'rotate-ccw',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');

  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } =
    useGetWalletSummary({ query: { enabled: !!isSignedIn, queryKey: getGetWalletSummaryQueryKey() } });
  const { data: txs, isLoading: txLoading, refetch: refetchTxs } =
    useListWalletTransactions(undefined, { query: { enabled: !!isSignedIn, queryKey: getListWalletTransactionsQueryKey() } });
  const withdrawal = useRequestWithdrawal();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const styles = makeStyles(colors);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchWallet(), refetchTxs()]);
    setRefreshing(false);
  }, [refetchWallet, refetchTxs]);

  const handleWithdraw = useCallback(() => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid Amount'); return; }
    if (!bankName.trim()) { Alert.alert('Enter bank name'); return; }
    if (!accountNumber.trim()) { Alert.alert('Enter account number'); return; }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    withdrawal.mutate(
      { data: { amount: amt, bankName: bankName.trim(), accountNumber: accountNumber.trim(), notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWalletSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListWalletTransactionsQueryKey() });
          setShowWithdraw(false);
          setAmount(''); setBankName(''); setAccountNumber(''); setNotes('');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Withdrawal Requested', 'We will process your withdrawal within 2-3 business days.');
        },
        onError: (err: unknown) => {
          const msg = err && typeof err === 'object' && 'error' in err
            ? String((err as any).error)
            : 'Could not process withdrawal.';
          Alert.alert('Error', msg);
        },
      },
    );
  }, [amount, bankName, accountNumber, notes, withdrawal, queryClient]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          signOut();
        },
      },
    ]);
  }, [signOut]);

  if (!isSignedIn) {
    return (
      <View style={[styles.authGate, { backgroundColor: colors.background, paddingTop: topInset + 40 }]}>
        <Feather name="credit-card" size={56} color={colors.mutedForeground} />
        <Text style={[styles.authTitle, { color: colors.foreground }]}>Your Wallet</Text>
        <Text style={[styles.authSubtitle, { color: colors.mutedForeground }]}>
          Sign in to view your cashback balance and transactions
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

  if (walletLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        Platform.OS === 'web'
          ? { paddingTop: topInset + 16, paddingBottom: 100 }
          : { paddingTop: topInset + 16, paddingBottom: 120 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Profile strip */}
      <View style={[styles.profileRow, { paddingHorizontal: 20 }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            {(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? 'U').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Welcome back'}
          </Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
            {user?.emailAddresses?.[0]?.emailAddress ?? ''}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={[styles.signOutBtn, { borderColor: colors.border }]}>
          <Feather name="log-out" size={18} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      {/* Balance card */}
      <LinearGradient
        colors={[colors.primary, `${colors.primary}BB`]}
        start={[0, 0]} end={[1, 1]}
        style={[styles.balanceCard, { marginHorizontal: 16, marginTop: 16 }]}
      >
        <Text style={styles.balanceLabel}>Available Cashback</Text>
        <Text style={styles.balanceAmount}>৳{(wallet?.availableCashback ?? 0).toFixed(2)}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Wallet Balance</Text>
            <Text style={styles.balanceStatValue}>৳{(wallet?.balance ?? 0).toFixed(2)}</Text>
          </View>
          <View style={[styles.balanceDivider]} />
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Pending</Text>
            <Text style={styles.balanceStatValue}>৳{(wallet?.pendingCashback ?? 0).toFixed(2)}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Points</Text>
            <Text style={styles.balanceStatValue}>{(wallet?.rewardPoints ?? 0).toLocaleString()}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Withdraw button */}
      <View style={[styles.actionsRow, { paddingHorizontal: 16, marginTop: 16 }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowWithdraw((v) => !v)}
        >
          <Feather name="send" size={20} color={colors.primary} />
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Withdrawal form */}
      {showWithdraw && (
        <View style={[styles.withdrawForm, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 16, marginTop: 12 }]}>
          <Text style={[styles.withdrawTitle, { color: colors.foreground }]}>Request Withdrawal</Text>
          {[
            { placeholder: 'Amount (BDT)', value: amount, setter: setAmount, keyboardType: 'numeric' as const },
            { placeholder: 'Bank Name', value: bankName, setter: setBankName, keyboardType: 'default' as const },
            { placeholder: 'Account Number', value: accountNumber, setter: setAccountNumber, keyboardType: 'numeric' as const },
            { placeholder: 'Notes (optional)', value: notes, setter: setNotes, keyboardType: 'default' as const },
          ].map((field) => (
            <TextInput
              key={field.placeholder}
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              placeholder={field.placeholder}
              placeholderTextColor={colors.mutedForeground}
              value={field.value}
              onChangeText={field.setter}
              keyboardType={field.keyboardType}
            />
          ))}
          <View style={styles.withdrawBtns}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowWithdraw(false)}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.withdrawSubmit, { backgroundColor: withdrawal.isPending ? colors.mutedForeground : colors.primary }]}
              onPress={handleWithdraw}
              disabled={withdrawal.isPending}
              activeOpacity={0.85}
            >
              {withdrawal.isPending
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Text style={[styles.withdrawSubmitText, { color: colors.primaryForeground }]}>Submit</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Transactions */}
      <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transactions</Text>
        {txLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : (txs?.length ?? 0) === 0 ? (
          <View style={styles.emptyTx}>
            <Feather name="activity" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {(txs ?? []).map((tx: WalletTransaction) => {
              const isCredit = tx.amount >= 0;
              const iconName = TX_ICONS[tx.type] ?? (isCredit ? 'arrow-down-left' : 'arrow-up-right');
              return (
                <View key={tx.id} style={[styles.txItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.txIcon, { backgroundColor: isCredit ? colors.accent : colors.muted }]}>
                    <Feather name={iconName as any} size={16} color={isCredit ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: isCredit ? colors.primary : colors.destructive }]}>
                    {isCredit ? '+' : '−'}৳{Math.abs(tx.amount).toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
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
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontFamily: FONT_BOLD },
    userName: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
    userEmail: { fontSize: 12, fontFamily: FONT_REGULAR, marginTop: 1 },
    signOutBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceCard: {
      borderRadius: colors.radius + 4,
      padding: 20,
    },
    balanceLabel: { fontSize: 13, fontFamily: FONT_MEDIUM, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
    balanceAmount: { fontSize: 36, fontFamily: FONT_BOLD, color: '#FFFFFF', marginBottom: 16 },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    balanceStat: { alignItems: 'center', gap: 3 },
    balanceStatLabel: { fontSize: 11, fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.7)' },
    balanceStatValue: { fontSize: 15, fontFamily: FONT_BOLD, color: '#FFFFFF' },
    balanceDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.3)' },
    actionsRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: colors.radius,
      borderWidth: 1,
      paddingVertical: 12,
    },
    actionBtnText: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    withdrawForm: {
      borderRadius: colors.radius,
      borderWidth: 1,
      padding: 16,
      gap: 10,
    },
    withdrawTitle: { fontSize: 16, fontFamily: FONT_SEMIBOLD, marginBottom: 4 },
    input: {
      height: 44,
      borderRadius: colors.radius - 2,
      borderWidth: 1,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: FONT_REGULAR,
    },
    withdrawBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderRadius: colors.radius - 2,
      paddingVertical: 11,
      alignItems: 'center',
    },
    cancelBtnText: { fontSize: 14, fontFamily: FONT_MEDIUM },
    withdrawSubmit: {
      flex: 2,
      borderRadius: colors.radius - 2,
      paddingVertical: 11,
      alignItems: 'center',
    },
    withdrawSubmitText: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    sectionTitle: { fontSize: 18, fontFamily: FONT_BOLD, marginBottom: 12 },
    emptyTx: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    emptyText: { fontSize: 14, fontFamily: FONT_MEDIUM },
    txItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: colors.radius - 2,
      borderWidth: 1,
      padding: 12,
      gap: 12,
    },
    txIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txDesc: { fontSize: 13, fontFamily: FONT_MEDIUM },
    txDate: { fontSize: 11, fontFamily: FONT_REGULAR, marginTop: 2 },
    txAmount: { fontSize: 14, fontFamily: FONT_BOLD },
  });
}
