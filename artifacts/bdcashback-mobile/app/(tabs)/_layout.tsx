import React from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useAuth } from '@clerk/expo';
import { useGetCart, getGetCartQueryKey } from '@workspace/api-client-react';

function CartBadge({ size }: { size?: number }) {
  const { isSignedIn } = useAuth();
  const { data: cart } = useGetCart({ query: { enabled: !!isSignedIn, queryKey: getGetCartQueryKey() } });
  const count = cart?.itemsCount ?? 0;
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : String(count)}</Text>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: isIOS ? 'absolute' : 'relative',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="storefront" tintColor={color} size={24} />
            ) : (
              <Ionicons name="storefront-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: 'Deals',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="tag" tintColor={color} size={24} />
            ) : (
              <Feather name="tag" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => (
            <View>
              {isIOS ? (
                <SymbolView name="cart" tintColor={color} size={24} />
              ) : (
                <Feather name="shopping-cart" size={22} color={color} />
              )}
              <CartBadge size={size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.bullet.rectangle" tintColor={color} size={24} />
            ) : (
              <Feather name="list" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="creditcard" tintColor={color} size={24} />
            ) : (
              <Ionicons name="wallet-outline" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
