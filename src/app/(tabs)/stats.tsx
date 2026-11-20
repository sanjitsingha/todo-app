import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ChipGroup, type ChipOption } from '@/components/ChipGroup';
import { OnTimeSummary } from '@/components/OnTimeSummary';
import { TodosWrittenChart, type ChartRange } from '@/components/TodosWrittenChart';
import { createThemedStyles } from '@/hooks/useTheme';

const RANGE_OPTIONS: readonly ChipOption<ChartRange>[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * The Stats tab: charts of how your todos are going, each on a white card on the gray page:
 * todos written per hour or day, and how many were done on time. The Today / Week / Month
 * chips just under the header pick the range for both; they stay put while the cards scroll.
 */
export default function StatsScreen() {
  const styles = useStyles();
  const [range, setRange] = useState<ChartRange>('week');

  return (
    <View style={styles.screen}>
      <View style={styles.chips}>
        <ChipGroup
          value={range}
          options={RANGE_OPTIONS}
          onChange={setRange}
          accessibilityLabel="Time range"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            Todos written
          </Text>
          <TodosWrittenChart range={range} />
        </View>

        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            On time
          </Text>
          <OnTimeSummary range={range} />
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    flex: 1,
  },
  chips: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  title: {
    marginBottom: 12,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
}));
