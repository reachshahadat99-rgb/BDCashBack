import React from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { type Href, Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignUp, useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [code, setCode] = React.useState('');

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const styles = makeStyles(colors);

  if (isSignedIn || signUp.status === 'complete') {
    router.replace('/');
    return null;
  }

  const handleSignUp = async () => {
    if (!email || !password) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    // Send email verification code
    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (url.startsWith('http')) {
            // web fallback
          } else {
            router.replace(url as Href);
          }
        },
      });
    }
  };

  // Needs email verification
  const needsVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  if (needsVerification) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset + 40 }]}>
        <View style={styles.box}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
            <Feather name="mail" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a 6-digit code to {email}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Enter code"
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={setCode}
            keyboardType="numeric"
            autoFocus
          />
          {errors?.fields?.code && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.fields.code.message}</Text>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleVerify}
            disabled={fetchStatus === 'fetching' || !code}
            activeOpacity={0.85}
          >
            {fetchStatus === 'fetching'
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify Email</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signUp.verifications.sendEmailCode()}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Resend code</Text>
          </TouchableOpacity>
        </View>
        {/* Required by Clerk for bot protection */}
        <View nativeID="clerk-captcha" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <View style={styles.logoArea}>
        <LinearGradient colors={[colors.primary, `${colors.primary}99`]} style={styles.logoCircle}>
          <Feather name="shopping-bag" size={28} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          BD<Text style={{ color: colors.secondary }}>Cashback</Text>
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join thousands earning cashback</Text>

      <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        placeholder="you@example.com"
        placeholderTextColor={colors.mutedForeground}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {errors?.fields?.emailAddress && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.fields.emailAddress.message}</Text>
      )}

      <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Min 8 characters"
          placeholderTextColor={colors.mutedForeground}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
          <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      {errors?.fields?.password && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.fields.password.message}</Text>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: !email || !password || fetchStatus === 'fetching' ? colors.muted : colors.primary }]}
        onPress={handleSignUp}
        disabled={!email || !password || fetchStatus === 'fetching'}
        activeOpacity={0.85}
      >
        {fetchStatus === 'fetching'
          ? <ActivityIndicator color={colors.primaryForeground} />
          : (
            <Text style={[
              styles.primaryBtnText,
              { color: !email || !password ? colors.mutedForeground : colors.primaryForeground },
            ]}>
              Create Account
            </Text>
          )
        }
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Required by Clerk for bot protection */}
      <View nativeID="clerk-captcha" />
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 24, paddingBottom: 40 },
    backBtn: { marginBottom: 24 },
    logoArea: { alignItems: 'center', marginBottom: 28, gap: 10 },
    logoCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    appName: { fontSize: 22, fontFamily: FONT_BOLD },
    title: { fontSize: 26, fontFamily: FONT_BOLD, marginBottom: 6 },
    subtitle: { fontSize: 15, fontFamily: FONT_REGULAR, marginBottom: 24 },
    label: { fontSize: 14, fontFamily: FONT_MEDIUM, marginBottom: 6 },
    input: {
      height: 48,
      borderRadius: colors.radius,
      borderWidth: 1,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: FONT_REGULAR,
      marginBottom: 4,
    },
    passwordRow: { position: 'relative', marginBottom: 4 },
    passwordInput: { paddingRight: 46 },
    eyeBtn: { position: 'absolute', right: 14, top: 14 },
    errorText: { fontSize: 12, fontFamily: FONT_REGULAR, marginBottom: 8, marginTop: -2 },
    primaryBtn: {
      height: 52,
      borderRadius: colors.radius,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    primaryBtnText: { fontSize: 16, fontFamily: FONT_SEMIBOLD },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
    footerText: { fontSize: 14, fontFamily: FONT_REGULAR },
    footerLink: { fontSize: 14, fontFamily: FONT_SEMIBOLD },
    linkText: { fontSize: 14, fontFamily: FONT_MEDIUM, textAlign: 'center', marginTop: 12 },
    box: { paddingHorizontal: 24, gap: 12, alignItems: 'stretch' },
    iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  });
}
