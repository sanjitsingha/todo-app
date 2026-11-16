import { StyleSheet, Text, View } from 'react-native';

import { PickerStrip } from '@/components/PickerStrip';
import { colors } from '@/constants/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

type Props = {
  /** In minutes, 0 up to 23 hr 59 min. */
  value: number;
  onChange: (minutes: number) => void;
};

/**
 * Swipeable hours (0 to 23) and minutes (00 to 59) strips for how long something takes: the
 * same strips as the reminder's time picker (src/components/TimePicker.tsx).
 */
export function DurationPicker({ value, onChange }: Props) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return (
    <View>
      <Text style={styles.caption}>HOURS</Text>
      <PickerStrip
        items={HOURS}
        value={hours}
        onChange={(index) => onChange(index * 60 + minutes)}
        accessibilityLabel="Hours"
      />

      <Text style={styles.caption}>MINUTES</Text>
      <PickerStrip
        items={MINUTES}
        value={minutes}
        onChange={(index) => onChange(hours * 60 + index)}
        accessibilityLabel="Minutes"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Same as the time picker's captions.
  caption: {
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 2,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
});
