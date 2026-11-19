import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';

type Props = {
  /** The digits typed so far. */
  value: string;
  onChangeText: (value: string) => void;
  /** How many digits the code has: one box each. */
  length: number;
  /** Called with the code once every box is filled, e.g. to check it right away. */
  onComplete?: (code: string) => void;
  /** What screen readers call it. */
  label: string;
  autoFocus?: boolean;
};

/**
 * A one-time code as a row of boxes, one digit in each, in the auth fields' soft gray. The box
 * the next digit goes in is outlined while you type. Underneath it's one invisible text field
 * spread over the boxes, so a tap anywhere opens the keyboard, and pasting a code or the
 * keyboard's suggestion from the email fills every box at once.
 */
export function OtpInput({ value, onChangeText, length, onComplete, label, autoFocus }: Props) {
  const [focused, setFocused] = useState(false);
  // The box being typed in: the first empty one, or the last once they're all filled.
  const current = Math.min(value.length, length - 1);

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, index) => (
        <View
          key={index}
          style={[styles.box, focused && index === current && styles.boxCurrent]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.digit}>{value[index] ?? ''}</Text>
        </View>
      ))}

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(text) => {
          // Digits only, so a pasted "123 456" still fits.
          const digits = text.replace(/\D/g, '').slice(0, length);
          onChangeText(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        // Always typing at the end, wherever the row was tapped.
        selection={{ start: value.length, end: value.length }}
        caretHidden
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  // Like AuthField's box: a transparent border all the time, so the outline doesn't shift it.
  box: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.inputBackground,
  },
  boxCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  digit: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  // Over the whole row, but not seen: the boxes show what's in it.
  input: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
    // Hides the browser's focus box on web (phones don't draw one).
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
});
