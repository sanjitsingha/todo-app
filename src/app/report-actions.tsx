import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionBadge } from '@/components/reporting/ActionBadge';
import { SheetGrabber } from '@/components/SheetGrabber';
import { REPORT_TYPES } from '@/constants/reportTypes';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import type { ReportType } from '@/lib/activity';
import { setReportFilters, useReportFilters } from '@/store/reportFilters';

const CHECKBOX_SIZE = 18;

/**
 * Sheet for which actions the Reporting tab shows, opened from its Actions filter: a row with a
 * checkbox for each. Any number can be ticked; none ticked shows them all. Each tick shows on
 * the tab straight away; Done (or swiping down) closes it. Just as tall as its rows.
 */
export default function ReportActionsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { types } = useReportFilters();

  const toggle = (type: ReportType) =>
    setReportFilters({
      types: types.includes(type) ? types.filter((value) => value !== type) : [...types, type],
    });

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 16;

  return (
    <View style={[styles.screen, { paddingBottom: bottomPadding }]}>
      <SheetGrabber />
      <Text style={styles.heading} accessibilityRole="header">
        Actions
      </Text>

      {REPORT_TYPES.map(({ value, label }) => {
        const checked = types.includes(value);
        return (
          <Pressable
            key={value}
            onPress={() => toggle(value)}
            style={({ pressed }) => [
              styles.option,
              // Android shows a ripple instead.
              pressed && Platform.OS !== 'android' && styles.optionPressed,
            ]}
            android_ripple={{ color: colors.ripple }}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityState={{ checked }}
          >
            <ActionBadge type={value} size={20} />
            <Text style={styles.optionText}>{label}</Text>
            {/* The todo list's checkbox. */}
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
            </View>
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.done, pressed && styles.donePressed]}
        accessibilityRole="button"
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // As in src/components/ChoiceSheet.tsx.
  screen: {
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
  },
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
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.iconInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // Same as the due-date sheet's Done.
  done: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePressed: {
    backgroundColor: colors.primaryPressed,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
}));
