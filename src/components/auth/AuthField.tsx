import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

import { colors } from '@/constants/theme';

type Props = Omit<TextInputProps, 'style' | 'secureTextEntry' | 'ref'> & {
  ref?: Ref<TextInputInstance>;
  label: string;
  /** Shown at the right end of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
  /** Hides what's typed, with an eye button to show it. */
  secure?: boolean;
  /** A line of help under the field, e.g. "At least 8 characters". */
  hint?: string;
};

/**
 * A labeled text field for the auth screens: a soft gray box that turns white with a dark
 * outline while you type in it.
 */
export function AuthField({
  ref,
  label,
  labelAction,
  secure = false,
  hint,
  onFocus,
  onBlur,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAction}
      </View>

      <View style={[styles.box, focused && styles.boxFocused]}>
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
        {secure ? (
          <Pressable
            onPress={() => setHidden((current) => !current)}
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

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: colors.ink,
    backgroundColor: colors.surface,
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
});
