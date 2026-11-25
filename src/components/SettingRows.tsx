import { Switch, Text, View } from 'react-native';

import { createThemedStyles, useColors } from '@/hooks/useTheme';

/** A section's title, above its rows, on a settings page (Calendar, General). */
export function SectionTitle({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

type SwitchRowProps = {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

/** A setting that's on or off: its name and a line about it, with the switch at the right. */
export function SwitchRow({ title, description, value, disabled = false, onChange }: SwitchRowProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.onPrimary}
        ios_backgroundColor={colors.border}
        accessibilityLabel={title}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    color: colors.text,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
}));
