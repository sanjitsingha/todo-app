import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { colors } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned to the bottom, e.g. "Don't have an account? Sign up". */
  footer?: ReactNode;
  /**
   * Splits the screen in two: the top 40% for `top` (and the back arrow), the bottom 60% a
   * white panel with the title, the form and the footer. Used by the login screen.
   */
  split?: boolean;
  /** What goes in the top 40% of a split screen, under the back arrow. */
  top?: ReactNode;
  /** What the back arrow does instead of going back, e.g. a step back within the screen. */
  onBack?: () => void;
};

/** How much of the screen's height the top part of a split screen takes. */
const SPLIT_TOP = 0.4;

/**
 * The frame shared by the login, register and forgot-password screens: a back arrow, a title
 * and subtitle, the form, and a footer at the bottom. Stays above the keyboard (Android apps
 * are edge-to-edge, so the window doesn't resize for it; "padding" is what Expo recommends on
 * both platforms) and scrolls on small screens.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
  split = false,
  top,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  // The window keeps its height while the keyboard is up (edge-to-edge), so the top part stays
  // the same size and the form scrolls up under it instead of squashing it.
  const { height } = useWindowDimensions();

  const form = (
    <>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.body}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  if (split) {
    return (
      <KeyboardAvoidingView behavior="padding" style={[styles.screen, styles.splitScreen]}>
        <ScrollView
          contentContainerStyle={styles.splitContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.top, { height: height * SPLIT_TOP, paddingTop: insets.top + 8 }]}>
            <View style={styles.back}>
              <BackButton onPress={onBack} />
            </View>
            {top}
          </View>

          <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>{form}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
          <BackButton onPress={onBack} />
        </View>

        {form}
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
  // The top part's color, which also shows around the panel's rounded corners.
  splitScreen: {
    backgroundColor: colors.primary,
  },
  splitContent: {
    flexGrow: 1,
  },
  top: {
    paddingHorizontal: 24,
  },
  // The bottom 60%: grows to the bottom of the screen, so the footer can sit there.
  panel: {
    flexGrow: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
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
