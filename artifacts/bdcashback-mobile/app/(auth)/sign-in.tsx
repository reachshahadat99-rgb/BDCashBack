import React, { useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Platform, ScrollView, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { type Href, Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignIn, useSSO, useAuth } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { FONT_BOLD, FONT_MEDIUM, FONT_REGULAR, FONT_SEMIBOLD } from '@/constants/fonts';

// Handle any pending auth sessions (required for Android)
WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  useWarmUpBrowser();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [ssoLoading, setSsoLoading] = React.useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const styles = makeStyles(colors);

  if (isSignedIn) {
    router.replace('/');
    return null;
  }

  const handleSignIn = async () => {
    if (!email || !password) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (url.startsWith('http')) {
            // web fallback – shouldn't happen in Expo native
          } else {
            router.replace(url as Href);
          }
        },
      });
    } else if (signIn.status === 'needs_client_trust') {
      const emailFactor = signIn.supportedSecondFactors?.find(
        (f) => f.strategy === 'email_code',
      );
      if (emailFactor) await signIn.mfa.sendEmailCode();
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (!url.startsWith('http')) router.replace(url as Href);
        },
      });
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({
          session: createdSessionId,
          navigate: async ({ decorateUrl }) => {
            const url = decorateUrl('/');
            if (!url.startsWith('http')) router.replace(url as Href);
          },
        });
      }
    } catch (err) {
      console.error(JSON.stringify(err));
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
    } finally {
      setSsoLoading(false);
    }
  }, [startSSOFlow, router]);

  // MFA / trust verification screen
  if (signIn.status === 'needs_client_trust') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset + 40 }]}>
        <View style={styles.box}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
            <Feather name="mail" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verify your account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enter the code sent to {email}
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
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signIn.mfa.sendEmailCode()}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Resend code</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signIn.reset()}>
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Start over</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back / close */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      {/* Logo */}
      <View style={styles.logoArea}>
        <LinearGradient colors={[colors.primary, `${colors.primary}99`]} style={styles.logoCircle}>
          <Feather name="shopping-bag" size={28} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          BD<Text style={{ color: colors.secondary }}>Cashback</Text>
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to access your rewards</Text>

      {/* Google SSO */}
      <TouchableOpacity
        style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handleGoogleSignIn}
        disabled={ssoLoading}
        activeOpacity={0.85}
      >
        {ssoLoading
          ? <ActivityIndicator size="small" color={colors.primary} />
          : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.googleBtnText, { color: colors.foreground }]}>Continue with Google</Text>
            </>
          )
        }
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Email */}
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
      {errors?.fields?.identifier && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.fields.identifier.message}</Text>
      )}

      {/* Password */}
      <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="••••••••"
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
        style={[
          styles.primaryBtn,
          { backgroundColor: !email || !password || fetchStatus === 'fetching' ? colors.muted : colors.primary },
        ]}
        onPress={handleSignIn}
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
              Sign In
            </Text>
          )
        }
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign up</Text>
          </TouchableOpacity>
        </Link>
      </View>
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
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: colors.radius,
      paddingVertical: 13,
      gap: 10,
      marginBottom: 20,
    },
    googleIcon: { fontSize: 18, fontFamily: FONT_BOLD, color: '#4285F4' },
    googleBtnText: { fontSize: 15, fontFamily: FONT_SEMIBOLD },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { fontSize: 13, fontFamily: FONT_REGULAR },
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
    // MFA/verify screen
    box: { paddingHorizontal: 24, gap: 12, alignItems: 'stretch' },
    iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  });
}
