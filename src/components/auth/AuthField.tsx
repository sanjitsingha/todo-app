import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode, type Ref } from 'react';
import { Pressable, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { createThemedStyles, useColors } from '@/hooks/useTheme';

type Props = Omit<TextInputProps, 'style' | 'secureTextEntry' | 'ref'> & {
  ref?: Ref<TextInputInstance>;
  label: string;
  /** Shown at the right end of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
  /** Hides what's typed, with an eye button to show it. */
  secure?: boolean;
  /**
   * Whether a `secure` field shows what's typed, when its parent decides (so one eye can show
   * two fields, like a new password and its confirmation). Left out, the field's own eye does.
   */
  revealed?: boolean;
  /** Called by the eye with the new `revealed`. */
  onRevealedChange?: (revealed: boolean) => void;
  /** False leaves out the eye, for a field another field's eye shows (with `revealed`). */
  revealButton?: boolean;
  /** A line of help under the field. */
  hint?: string;
  /** What's wrong with what's typed, e.g. "At least 8 characters": in red, in place of `hint`. */
  error?: string | null;
  /**
   * Just the soft gray box, the same while you type in it: no label above it (`label` is still
   * what screen readers say, and `labelAction` isn't shown), so the placeholder says what goes
   * in it, and no outline. Used by the login screen's email form.
   */
  minimal?: boolean;
};

/**
 * A labeled text field for the auth screens and Account: a soft gray box that turns to the
 * surface color, outlined in the Dooist orange, while you type in it (or stays gray with no label
 * or outline, when `minimal`).
 */
export function AuthField({
  ref,
  label,
  labelAction,
  secure = false,
  revealed,
  onRevealedChange,
  revealButton = true,
  hint,
  error,
  minimal = false,
  onFocus,
  onBlur,
  ...inputProps
}: Props) {
  const styles = useStyles();
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [ownHidden, setOwnHidden] = useState(true);
  const hidden = revealed === undefined ? ownHidden : !revealed;

  const toggleHidden = () => {
    if (revealed === undefined) setOwnHidden(!hidden);
    onRevealedChange?.(hidden);
  };

  return (
    <View>
      {minimal ? null : (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {labelAction}
        </View>
      )}

      <View
        style={[styles.box, minimal ? styles.boxMinimal : focused && styles.boxFocused]}
      >
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={secure && hidden}
          // Just the line cursor: hides the drop-shaped handle Android puts under it.
          selectionHandleColor="transparent"
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {secure && revealButton ? (
          <Pressable
            onPress={toggleHidden}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={[styles.hint, styles.error]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  // A transparent border all the time, so focusing doesn't shift the text.
  box: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.inputBackground,
  },
  boxFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  boxMinimal: {
    borderWidth: 0,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 16,
    color: colors.text,
    // Hides the browser's focus box on web (phones don't draw one).
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  eye: {
    paddingStart: 8,
  },
  hint: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
  },
}));
