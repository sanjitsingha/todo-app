import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * The main action of an auth screen. Same look as the "Add todo" button. While `loading`, it
 * shows a spinner instead of its label and can't be pressed again.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        styles.primary,
        disabled && styles.disabled,
        pressed && styles.primaryPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

/** What went wrong (a wrong password, no internet), in red above the main button. */
export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

/** White outlined button with the Google "G". */
export function GoogleButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.outline, pressed && styles.outlinePressed]}
      accessibilityRole="button"
    >
      <Ionicons name="logo-google" size={18} color={colors.ink} />
      <Text style={styles.outlineText}>Continue with Google</Text>
    </Pressable>
  );
}

/** A thin line with "or" in the middle, between the Google button and the email form. */
export function OrDivider() {
  return (
    <View style={styles.divider} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

/** Small bold text that acts as a link, e.g. "Forgot password?". */
export function TextLink({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Text onPress={onPress} suppressHighlighting style={styles.link} accessibilityRole="link">
      {children}
    </Text>
  );
}

/** "Don't have an account? Sign up", for the bottom of an auth screen. */
export function FooterPrompt({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Text style={styles.prompt}>
      {prompt} <TextLink onPress={onPress}>{action}</TextLink>
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primary: {
    marginTop: 8,
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  outlinePressed: {
    backgroundColor: colors.inputBackground,
  },
  outlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  prompt: {
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
  },
});
