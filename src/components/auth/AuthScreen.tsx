import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { createThemedStyles } from '@/hooks/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned to the bottom, e.g. "Don't have an account? Sign up". */
  footer?: ReactNode;
  /**
   * Splits the screen in two: the top 60% for `top` (and the back arrow), the bottom 40% a
   * white panel with the title, the form and the footer. Used by the login and sign-up screens.
   * When the panel needs more than 40% (their forms do, on most phones), it grows up into the
   * top part, which keeps at least room for the back arrow; past that, the screen scrolls.
   */
  split?: boolean;
  /** What goes in the top part of a split screen, under the back arrow. */
  top?: ReactNode;
  /**
   * False for a screen with nothing to go back to (log in, which is where signed out starts,
   * and new password). Its room is kept, so the title sits where it does on the others.
   */
  showBack?: boolean;
};

/** How much of the screen's height the top part of a split screen takes, at most. */
const SPLIT_TOP = 0.6;

/**
 * The frame shared by the login, register, forgot password and new password screens: a back
 * arrow, a title and subtitle, the form, and a footer at the bottom. Stays above the keyboard
 * (Android apps are edge-to-edge, so the window doesn't resize for it; "padding" is what Expo
 * recommends on both platforms) and scrolls on small screens.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
  split = false,
  top,
  showBack = true,
}: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const back = showBack ? (
    <View style={styles.back}>
      <BackButton />
    </View>
  ) : (
    <View style={styles.noBack} />
  );
  // The height the split screen has to show itself in: the window's, until it's laid out. It
  // loses the keyboard's height while that's up (the padding below), so the top part gives up
  // its room first and the form stays above the keyboard.
  const { height: windowHeight } = useWindowDimensions();
  const [visibleHeight, setVisibleHeight] = useState(0);
  const height = visibleHeight || windowHeight;

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
          onLayout={(event) => setVisibleHeight(event.nativeEvent.layout.height)}
        >
          {/* Fills what the panel leaves, up to 60%. */}
          <View
            style={[styles.top, { maxHeight: height * SPLIT_TOP, paddingTop: insets.top + 8 }]}
          >
            {back}
            {top}
          </View>

          {/* At least the other 40%, and as tall as its content when that's more. */}
          <View
            style={[
              styles.panel,
              { minHeight: height * (1 - SPLIT_TOP), paddingBottom: insets.bottom + 24 },
            ]}
          >
            {form}
          </View>
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
        {back}

        {form}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
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
  // Grows into whatever the panel doesn't take, up to its 60% (maxHeight, set above).
  top: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  // The bottom 40% or more (minHeight, set above). The footer sits at its bottom.
  panel: {
    paddingTop: 32,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.page,
  },
  // The arrow's icon lines up with the title (the button has its own margin and padding).
  back: {
    alignSelf: 'flex-start',
    marginStart: -16,
    marginBottom: 24,
  },
  // The back arrow's room when there isn't one: the button (24 icon + 8 padding each side)
  // and its margin below.
  noBack: {
    height: 40,
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
}));
