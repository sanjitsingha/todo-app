import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { colors } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned to the bottom, e.g. "Don't have an account? Sign up". */
  footer?: ReactNode;
};

/**
 * The frame shared by the login, register and forgot-password screens: a back arrow, a title
 * and subtitle, the form, and a footer at the bottom. Stays above the keyboard (Android apps
 * are edge-to-edge, so the window doesn't resize for it; "padding" is what Expo recommends on
 * both platforms) and scrolls on small screens.
 */
export function AuthScreen({ title, subtitle, children, footer }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
        // A tap on a button works right away with the keyboard up, instead of only closing it.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.back}>
          <BackButton />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.body}>{children}</View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // Grows to the screen's height, so the footer can sit at the bottom.
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  // The arrow's icon lines up with the title (the button has its own margin and padding).
  back: {
    alignSelf: 'flex-start',
    marginStart: -16,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  body: {
    marginTop: 32,
    gap: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
});
