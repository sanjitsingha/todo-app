import { useRouter } from 'expo-router';
import { useEffect, useRef, type ComponentType } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetGrabber } from '@/components/SheetGrabber';
import { createThemedStyles, useColors } from '@/hooks/useTheme';

/** After a pick, the sheet stays this long, so the radio is seen moving, then closes. */
const CLOSE_DELAY_MS = 250;
const RADIO_SIZE = 18;
const RADIO_DOT_SIZE = 8;

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** A Lucide icon shown before the label. */
  icon?: ComponentType<{ size?: number; color?: string }>;
};

const ICON_SIZE = 20;

type Props<T extends string> = {
  title: string;
  options: readonly Choice<T>[];
  value: T;
  /** Saves the pick. The sheet closes on its own just after. */
  onPick: (value: T) => void;
};

/** A round radio button: an empty ring, or a ring with a dot in it when picked. */
export function Radio({ selected }: { selected: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

/**
 * A bottom sheet for picking one of a few options, like Profile's Haptic Feedback and
 * Appearance: a title, then a row per option (with its icon, if it has one) and its radio
 * button on the right. Picking one
 * saves it and closes the sheet. Meant for a route shown as a sheet just as tall as its
 * content (`sheetAllowedDetents: 'fitToContents'` in src/app/_layout.tsx).
 */
export function ChoiceSheet<T extends string>({ title, options, value, onPick }: Props<T>) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const pick = (next: T) => {
    onPick(next);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => router.back(), CLOSE_DELAY_MS);
  };

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 16;

  return (
    <View style={[styles.screen, { paddingBottom: bottomPadding }]}>
      <SheetGrabber />
      <Text style={styles.heading} accessibilityRole="header">
        {title}
      </Text>

      <View accessibilityRole="radiogroup" accessibilityLabel={title}>
        {options.map((option) => {
          const selected = option.value === value;
          const Icon = option.icon;
          return (
            <Pressable
              key={option.value}
              onPress={() => pick(option.value)}
              style={({ pressed }) => [
                styles.option,
                // Android shows a ripple instead.
                pressed && Platform.OS !== 'android' && styles.optionPressed,
              ]}
              android_ripple={{ color: colors.ripple }}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
            >
              {Icon ? <Icon size={ICON_SIZE} color={colors.ink} /> : null}
              <Text style={styles.optionText}>{option.label}</Text>
              <Radio selected={selected} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
  },
  // As on the app's other sheets.
  heading: {
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  option: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionPressed: {
    backgroundColor: colors.inputBackground,
  },
  // Takes the room between the icon and the radio, so the radio sits at the right.
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.ink,
  },
  radioDot: {
    width: RADIO_DOT_SIZE,
    height: RADIO_DOT_SIZE,
    borderRadius: RADIO_DOT_SIZE / 2,
    backgroundColor: colors.ink,
  },
}));
