/**
 * Design tokens for BDCashBack Mobile — derived from sibling web artifact (index.css).
 * Primary: Deep Vibrant Teal (trust, money, premium)
 * Secondary: Gold/Amber (cashback, rewards)
 */
const colors = {
  light: {
    text: '#0F172A',
    tint: '#109880',

    background: '#F8FAFD',
    foreground: '#0F172A',

    card: '#FFFFFF',
    cardForeground: '#0F172A',

    primary: '#109880',
    primaryForeground: '#FFFFFF',

    secondary: '#F5B82C',
    secondaryForeground: '#0F172A',

    muted: '#F1F5F9',
    mutedForeground: '#64748B',

    accent: '#E8FAF7',
    accentForeground: '#0A5C52',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    border: '#E2E8F0',
    input: '#E2E8F0',
  },

  dark: {
    text: '#F8FAFC',
    tint: '#14BAA0',

    background: '#0F172A',
    foreground: '#F8FAFC',

    card: '#162032',
    cardForeground: '#F8FAFC',

    primary: '#14BAA0',
    primaryForeground: '#0F172A',

    secondary: '#F5B82C',
    secondaryForeground: '#0F172A',

    muted: '#1E293B',
    mutedForeground: '#94A3B8',

    accent: '#1E293B',
    accentForeground: '#F8FAFC',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    border: '#1E293B',
    input: '#1E293B',
  },

  // 0.75rem = 12px — matches web --radius: 0.75rem
  radius: 12,
};

export default colors;
