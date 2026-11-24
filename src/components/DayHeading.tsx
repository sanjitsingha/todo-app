import { Text, View } from 'react-native';

import { createThemedStyles } from '@/hooks/useTheme';
import { formatActivityDay, fromDateKey, type DateKey } from '@/lib/dates';

/**
 * A day's heading over a list: "27 Nov · Friday" (with Today, Tomorrow or Yesterday when it is),
 * how many things are under it, and a line. As on the web app, for Upcoming and Reporting. On
 * the page's color edge to edge, so it can stay at the top while its day scrolls under it.
 */
export function DayHeading({ day, today, count }: { day: DateKey; today: DateKey; count: number }) {
  const styles = useStyles();
  return (
    <View style={styles.heading}>
      <View style={styles.line}>
        <Text style={styles.title} accessibilityRole="header">
          {formatActivityDay(day, fromDateKey(today))}
        </Text>
        <Text style={styles.count}>{count}</Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  heading: {
    paddingHorizontal: 16,
    backgroundColor: colors.page,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 2,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  count: {
    fontSize: 14,
    color: colors.textMuted,
  },
}));
