import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text } from 'react-native';

import { createThemedStyles, useColors } from '@/hooks/useTheme';

/** A Reporting filter: what it's set to, with an arrow. Tapping it opens its sheet of choices. */
export function FilterButton({
  label,
  summary,
  onPress,
}: {
  /** What the filter is, for screen readers, e.g. "Date". */
  label: string;
  summary: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${summary}`}
      accessibilityHint="Opens the choices"
    >
      <Text style={styles.text} numberOfLines={1}>
        {summary}
      </Text>
      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // Shrinks, shortening its text, when the row is short of room. Just its text and arrow, with
  // a shade only while pressed, like the app's dropdowns (src/components/Dropdown.tsx).
  button: {
    flexShrink: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pressed: {
    backgroundColor: colors.inputBackground,
  },
  text: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
}));
